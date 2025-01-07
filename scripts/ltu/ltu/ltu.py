import errno
import json
import os
import random
import secrets
import subprocess
import sys
import time

import paramiko
import scp
from geographiclib.geodesic import Geodesic
import traceback

from ltu import devices


BASESTATION = [32.365479, -112.878797]
DEFAULT_BEARING = 40
SECTORS = [
    ["360",    -15, 10, 5265, 30],
    ["005-LR",   2.5, 7.5, 5485, 30],  # 5

    ["010-LR",  7.5,  12.5, 5590, 40],
    ["015-LR", 12.5, 17.5, 5535, 30],

    ["020",     10, 30, 5300, 30],
    ["021",     10, 30, 5520, 30],
    ["020-LR",  17.5, 25, 5625, 30],

    ["030-LR",  25, 35, 5660, 30],

    ["041",     30, 50, 5555, 30],
    ["040-LR",  35, 42.5, 5590, 30],

    ["045-LR", 42.5, 47.5, 5535, 30],
    ["050-LR", 47.5, 55, 5625, 30],

    ["060",     50, 70, 5265, 30],
    ["060-LR",  55, 65, 5660, 30],

    ["080",     70, 90, 5695, 30],
    ["130",     100, 160, 5290, 80],
]
LTU_VERSION = {
    "afltu": "v2.3.4"
}
LTU_IP = "192.168.1.20"


def provision(customer):
    print('{"progress": 1, "status":"Provisioning started, connecting to device..."}')
    while True:
        try:
            if loop(customer):
                break
        except OSError as e:
            if e.errno == errno.EL2HLT or (100 <= e.errno <= 113):
                print('{"progress": 1, "status":"Unreachable"}')
        except Exception as e:
            traceback.print_exc()
    print('{"progress": 100, "status":"Success"}"')


def upgrade(ssh, scp_client, platform, version):
    pv = platform + "." + version
    print(json.dumps({"progress": 55, "status":"Upgrade to " + pv}))
    scp_client.put("firmware/" + pv + ".bin", "/tmp/fwupdate.bin")
    print(json.dumps({"progress": 65, "status": "Upload complete, upgrading..."}))
    exe(ssh, "/sbin/fwupdate -m")


def loop(customer):
    try:
        device_info = devices.get_info()
        credentials = devices.get_credentials(device_info)
        ssh = get_ltu_ssh(LTU_IP, credentials)
    except Exception:
        print('{"progress": 5, "status":"Couldn\'t connect using device password, try with default instead"}')
        device_info = {}
        credentials = devices.get_credentials(device_info)
        ssh = get_ltu_ssh(LTU_IP, credentials)
    scp_client = get_scp_client(ssh)

    scp_client.get("/tmp/system.cfg", "./")
    config = load_config()
    edit_config(config, customer)
    save_config(config)
    scp_client.put("./system.cfg", "/tmp/system.cfg")
    os.unlink("system.cfg")
    channel = ssh.invoke_shell()
    while not channel.send_ready():
        time.sleep(0.1)
    channel.send(b"save\n")
    buffer = b'A'
    while True:
        buffer += channel.recv(256)
        if buffer.decode("utf8").count("afltu.v") >= 2:
            break
    time.sleep(1)
    print('{"progress": 50, "status":"Save succeeded"}')
    device_info = devices.get_info()
    credentials = devices.get_credentials(device_info)

    [platform, version] = exe(ssh, "af get version").split(".", 1)
    latest_version = LTU_VERSION[platform]
    print("[LTU]", platform, version, file=sys.stderr)
    if version != latest_version:
        upgrade(ssh, scp_client, platform, latest_version)
        scp_client.close()
        ssh.close()
        time.sleep(30)
        ssh = False
        while not ssh:
            try:
                ssh = get_ltu_ssh(LTU_IP, credentials)
                scp_client = get_scp_client(ssh)
                break
            except Exception:
                pass

    scp_client.close()
    ssh.close()
    return True


def edit_config(config, customer):
    config["ame.net.jumbo"] = "disabled"
    config["ame.net.lan_en"] = "enabled"
    config["bridge.1.status"] = "enabled"
    config["dhcpc.1.status"] = "enabled"
    config["discovery.cdp.status"] = "disabled"
    config["discovery.status"] = "enabled"
    config["gui.language"] = "en_US"
    config["gui.network.advanced.status"] = "disabled"
    config["httpd.port"] = "80"
    config["httpd.session.timeout"] = "900"
    config["httpd.status"] = "enabled"
    config["igmpproxy.status"] = "disabled"
    config["netconf.1.autoip.status"] = "disabled"
    config["netconf.1.flowcontrol.rx.status"] = "enabled"
    config["netconf.1.flowcontrol.tx.status"] = "enabled"
    config["netconf.1.mtu"] = "1500"
    config["netconf.1.speed"] = "auto"
    config["netconf.2.autoip.status"] = "disabled"
    config["netconf.2.mtu"] = "1500"
    if "netconf.2.up" in config:
        config.pop("netconf.2.up")
    config["radio.countrycode"] = "840"
    config["resolv.nameserver.status"] = "enabled"
    config["snmp.rwcommunity.status"] = "disabled"
    config["snmp.status"] = "disabled"
    config["sshd.auth.passwd"] = "enabled"
    config["system.date.status"] = "disabled"
    config["system.external.reset"] = "enabled"
    config["system.imperial_units.status"] = "disabled"
    config["system.timezone"] = "MST7MDT,M3.2.0,M11.1.0"
    config["unms.status"] = "disabled"
    config["update.cent.status"] = "enabled"
    config["update.check.status"] = "enabled"
    config["users.1.status"] = "enabled"
    config["users.2.gid"] = "100"
    config["users.2.shell"] = "/bin/false"
    config["users.2.status"] = "disabled"
    config["users.2.uid"] = "100"
    config["wireless.1.frame_offset"] = "0"
    config["wireless.1.mcast.enhance"] = "0"
    config["wireless.1.rate.mcs"] = "4"
    config["wireless.1.scan_list.status"] = "disabled"
    config["wireless.1.status"] = "enabled"
    config["wireless.1.sync_mode"] = "1"
    config["wireless.status"] = "enabled"
    config["radio.1.reg_obey"] = "disabled"
    config["radio.1.auto_txpower"] = "enabled"

    bearing = DEFAULT_BEARING
    _lat, _lon = "", ""
    hostname = "missing"
    if customer:
        _lat, _lon = str(customer["lat"]), str(customer["lon"])
        bearing = get_bearing(customer)
        hostname = customer["hostname"]

    [sector, freq, bw] = get_sector(bearing)
    print("[LTU] FRI-" + str(sector), freq, bw, file=sys.stderr)

    config["resolv.host.1.name"] = "LTU-" + hostname
    config["radio.1.chanbw"] = str(bw)
    config["radio.1.freq"] = str(freq)
    config["radio.1.rxfreq"] = str(freq)
    config["radio.1.txfreq"] = str(freq)
    config["wireless.1.ssid"] = "FRI-" + sector
    config["wireless.1.security"] = "WPA2-PSK"
    config["wireless.1.security.psk"] = "free range javelinas"
    config["users.1.name"] = "ubnt"
    if config["users.1.password"] == "$1$tL963iDU$SXu0h02ZZYfnoZcPkIlK21":
        device_info = devices.create_info()
        credentials = devices.get_credentials(device_info)
        salt = secrets.token_urlsafe(8)[0:8]
        command = "openssl passwd -1 -salt " + salt + " " + credentials[1]
        hashed = subprocess.getoutput(command).strip()
        print("[LTU]", command, hashed, file=sys.stderr)
        config["users.1.password"] = hashed
    config["system.height"] = ""
    config["system.latitude"] = _lat
    config["system.longitude"] = _lon
    config["unms.status"] = "enabled"
    config["unms.uri"] = "wss://uisp.ajowifi.net:443+WooA7xNFeqw8AY5c5ACnB5VWJQWEf8qdOgL5NOfE23ubCPNB+allowSelfSignedCertificate"


def get_bearing(customer):
    coordinates = [customer["lat"], customer["lon"]]
    res = Geodesic.WGS84.Inverse(BASESTATION[0], BASESTATION[1], coordinates[0], coordinates[1])
    return res["azi1"]

def get_sector(heading):
    # First find the tightest sector beam
    minhdgdelta = 360
    for [sector, h1, h2, freq, bw] in SECTORS:
        if h1 <= heading <= h2:
            minhdgdelta = min(minhdgdelta, h2 - h1)
    # Then find all the sectors that match and have such a tight beam
    found = []
    for [sector, h1, h2, freq, bw] in SECTORS:
        if h1 <= heading <= h2 and minhdgdelta == h2 - h1:
            found.append([sector, freq, bw])
    if len(found) > 0:
        return random.choice(found)

def get_potential_sectors(heading):
    res = []
    for [sector, h1, h2, freq, bw] in SECTORS:
        beamwidth = h2 - h1
        h1 = h1 - beamwidth * 0.25
        h2 = h2 + beamwidth * 0.25
        if h1 <= heading <= h2:
            res.append(sector)
    return res

def load_config():
    with open("system.cfg", "r") as file:
        contents = file.readlines()
    return {k: v.strip() for [k, v] in [pair.split("=", 1) for pair in contents]}


def save_config(config):
    contents = [k + "=" + v + "\n" for k, v in config.items()]
    with open("system.cfg", "w") as file:
        file.truncate()
        file.writelines(contents)


def get_scp_client(ssh):
    return scp.SCPClient(ssh.get_transport())


def exe(ssh, command):
    _, stdout, _ = ssh.exec_command(command)
    channel = stdout.channel
    res = stdout.read().decode('utf8').strip()
    channel.recv_exit_status()
    return res


def get_ltu_ssh(ip, credentials):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.MissingHostKeyPolicy)
    ssh.connect(ip, username=credentials[0], password=credentials[1], allow_agent=False, look_for_keys=False)
    return ssh
