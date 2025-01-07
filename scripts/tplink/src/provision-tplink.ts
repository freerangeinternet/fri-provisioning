import {Browser, chromium, Page} from "playwright";
import {assertNotCancelled, status, statusError} from "./main";
import * as fs from "node:fs";

type Task = "Login" | "Upgrade" | "Hostname" | "WiFi" | "Admin" | "Reset"
type Params = {
    password: string,
    alternativePasswords?: string[],
    hostname: string,
    ssid: string,
    psk: string,
}

const DEBUG = process.env.DEBUG ?? false

export async function setupTPLink(params: Params): Promise<true | { error: any, screenshot?: Buffer }> {
    status("Opening browser")
    const browser = await chromium.launch({headless: !DEBUG})
    const page = await browser.newPage({viewport: {width: 1280, height: 1280}})
    page.setDefaultTimeout(30e3)
    status("Connecting to router", 1)
    let i = 0;
    while (true) {
        assertNotCancelled()
        try {
            await page.goto("http://192.168.88.1", {timeout: 3000})
            break
        } catch (e) {
            status("Cannot connect to router... retrying", 1)
            // @ts-ignore
            if (typeof e.message === 'string' && (e.message.startsWith("page.goto: net::ERR_ADDRESS_UNREACHABLE") || e.message.startsWith("page.goto: net::ERR_CONNECTION_REFUSED") || e.message.startsWith("page.goto: Timeout"))) {
                i++
                if (i >= 75) {
                    statusError("Cannot connect to router")
                    return {error: "Cannot connect to router"}
                }
            } else {
                // @ts-ignore
                return {error: e.message || e}
            }
            await sleep(0.5)
        }
    }
    const tasks: Task[] = [
        "Login",
        "Upgrade",
        "Hostname",
        "WiFi",
        "Admin",
    ]
    try {
        while (tasks.length > 0) {
            await loaded(page)
            let res;
            switch (tasks[0]) {
                case "Login":
                    res = await login(page, params.password, params.alternativePasswords)
                    break
                case "Upgrade":
                    res = await upgrade(page)
                    if (res) {
                        res = false
                        tasks.unshift("Login")
                    } else tasks.shift()
                    break
                case "Hostname":
                    res = await setHostname(page, params.hostname)
                    break
                case "WiFi":
                    res = await setWiFi(page, params.ssid, params.psk)
                    break
                case "Admin":
                    res = await setAdmin(page)
                    break
                case "Reset":
                    res = await reset(page)
                    break
            }
            if (res) tasks.shift()
        }
        return true
    } catch (error) {
        const screenshot = await page.screenshot({type: "png"})
        return {error, screenshot}
    } finally {
        if (!DEBUG)
            await browser.close()
    }
}

async function login(page: Page, password: string, alternativePasswords?: string[]) {
    if (await page.isVisible("#pc-setPwd-new")) {
        status("Create password", 5)
        await page.locator("#pc-setPwd-new").fill(password)
        await page.locator("#pc-setPwd-confirm").fill(password)
        await page.locator("#pc-setPwd-btn").click()
        status("Password created")
        return false
    } else if (await page.isVisible("#pc-login-password")) {
        status("Log in", 10)
        const passwords = [password, ...alternativePasswords || []]
        for (const pw of passwords) {
            console.error("Log in with password " + pw)
            await page.locator("#pc-login-password").fill(pw)
            await page.locator("#pc-login-btn").click()
            await loaded(page)
            await sleep(0.25)
            if (await page.isVisible("#confirm-yes")) {
                if (await page.locator("#confirm-yes").textContent() === "Log in") {
                    await page.locator("#confirm-yes").click()
                    await loaded(page)
                    await sleep(3.25)
                }
            }
            if (await page.isVisible("#pc-login-password")) {
                console.error("Wrong password")
            } else {
                status("Logged in")
                return false
            }
        }
        throw new Error("Invalid password")
    } else if (await page.isVisible("#t_regionNote")) {
        status("Set region", 15)
        await tpSelectByText(page, "_region", "United States")
        await tpSelectByVal(page, "_timezone", "-07:00")
        await page.click("#next")
        await waitForMaskOff(page)
        status("Region set")
        return false
    } else if (await page.isVisible("#wan_next")) {
        status("Skip quick setup", 20)
        await page.click("#wan_next")
        await waitForMaskOff(page)
        let progress = 21
        while (await page.isHidden("#advanced")) {
            status("Skip quick setup", progress++)
            await page.click("#next")
            await waitForMaskOff(page)
        }
        status("Quick setup successful", 30)
        await page.click("#advanced")
        await sleep(0.5)
        return true
    } else if (await page.isVisible("#advanced")) {
        status("Click advanced", 30)
        await page.click("#advanced")
        await sleep(0.5)
        return true
    } else {
        throw new Error("Unknown page while trying to log in")
    }
}

async function loaded(page: Page) {
    assertNotCancelled()
    await page.waitForLoadState()
    assertNotCancelled()
    await page.waitForLoadState("networkidle")
    assertNotCancelled()
}

const sleep = (seconds: number) => new Promise<void>((resolve, reject) => setTimeout(() => {
    try {
        assertNotCancelled()
    } catch (e) {
        reject(e)
    }
    resolve()
}, seconds * 1000))

async function upgrade(page: Page) {
    status("Go to upgrade", 32)
    await page.click("#toUpgrade")
    await sleep(1)
    const sver = await page.locator("#bot_sver").textContent()
    if (sver == null) throw new Error("#bot_sver.textContent() is null")
    const hver = await page.locator("#bot_hver").textContent()
    if (hver == null) throw new Error("#bot_hver.textContent() is null")
    const upgradeFileName = getUpgradeFileName(hver, sver)
    if (upgradeFileName != null) {
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByRole('button', {name: 'Browse'}).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(upgradeFileName);
        await sleep(1);
        if (await page.isVisible("label[for=chk_AP1] > span"))
            await page.locator("label[for=chk_AP1] > span").click()
        await page.click("#t_local_upgrade")
        status("Uploading firmware", 35)
        await sleep(1)
        await page.isVisible(".T_wait_upgrade")
        status("Rebooting", 38)
        await Promise.race([new Promise<void>((resolve, _) => {
            page.on("load", () => {
                resolve();
            })
        }), sleep(180)]);
        return true
    }
    await toggleRadioButtonTo(page, "div_autoUpgradeBtn", true)
    await sleep(1)
    return false
}

function getUpgradeFileName(hver: string, sver: string) {
    sver = sver.replace("Firmware Version:", "").replace(/\s/g, "_")
    hver = hver.replace("Hardware Version:", "").replace(/\s/g, "_")
    const files = fs.readdirSync("firmware")
    const matching = files.filter(name => name.startsWith(hver))
    if (matching.length === 0)
        throw new Error("No firmware found for " + hver)
    if (matching.length > 1)
        throw new Error("Multiple firmware found for " + hver)
    const [fwfilename] = matching
    const fwver = fwfilename.slice(hver.length + 1, -4)
    const isUpToDate = sver.startsWith(fwver)
    if (isUpToDate) {
        return null
    } else {
        return "firmware/" + fwfilename
    }
}

async function setHostname(page: Page, hostname: string) {
    status("Go to WAN page", 35)
    await page.click(".ml1 > a[url='ethWan.htm']")
    await page.click(".ml2 > a[url='ethWan.htm']")
    await sleep(1)
    status("Set hostname to " + hostname, 40)
    await page.click("#multiWanBody span.edit-modify-icon")
    await page.click("#multiWanEdit span.advanced-icon")
    await page.fill("#hostname", hostname)
    await page.click("#saveConnBtn")
    await waitForMaskOff(page)
    await sleep(1)
    status("Hostname set")
    return true
}

async function setWiFi(page: Page, ssid: string, psk: string) {
    status("Go to wireless page", 45)
    if (await page.isHidden(".ml2 > a[url='wirelessSettings.htm']")) {
        await page.click(".ml1 > a[url='wirelessSettings.htm']")
        await sleep(0.5)
    }
    await page.click(".ml2 > a[url='wirelessSettings.htm']")
    await sleep(1)
    if (await page.isVisible("#enableOfdma")) {
        status("Disable OFDMA", 50)
        await toggleRadioButtonTo(page, "enableOfdma", false)
    }
    if (await page.isVisible("#enableTwt")) {
        status("Disable TWT", 60)
        await toggleRadioButtonTo(page, "enableTwt", false)
    }
    status("Set SSID & PSK", 70)
    await page.fill("#ssid", ssid)
    await tpSelectByText(page, "_sec", "WPA-PSK[TKIP]+WPA2-PSK[AES]")
    await page.fill("#wpa2PersonalPwd", psk)
    let channelWidth = "20MHz"
    const hwver = await page.locator("#bot_hver").textContent()
    if (hwver !== null && hwver.includes("HX510")) channelWidth = "40MHz"
    status("Set channel width to " + channelWidth, 75)
    await page.click("#dynAdvClick")
    await tpSelectByVal(page, "_chnwidth_adv_2g", "20MHz")
    await tpSelectByVal(page, "_chnwidth_adv_5g", channelWidth)

    await page.click("#save")
    await waitForMaskOff(page)
    return true
}

async function setAdmin(page: Page) {
    status("Go to admin", 80)
    if (await page.isHidden(".ml2 > a[url='manageCtrl.htm']")) {
        await page.click(".ml1 > a[url='time.htm']")
        await sleep(0.5)
    }
    await page.click(".ml2 > a[url='manageCtrl.htm']")
    await sleep(1)
    status("Set remote access", 90)
    if (!await page.isChecked("#remoteHttpEn")) {
        await page.click("label[for=remoteHttpEn]")
        await sleep(0.5)
        const selector = "#alert-container button.btn-msg-ok"
        if (await page.isVisible(selector)) {
            await page.click(selector)
        }
        await page.click("#t_save3")
        await waitForMaskOff(page);
        await sleep(1);
    }
    status("Set remote ping", 95)
    if (!await page.isChecked("#pingRemote")) {
        await page.click("label[for=pingRemote]")
        await page.click("#t_save4")
        await waitForMaskOff(page)
    }
    return true
}

async function reset(page: Page) {
    status("Reset to factory defaults")
    if (await page.isHidden(".ml2 > a[url='backNRestore.htm']")) {
        await page.click(".ml1 > a[url='time.htm']")
        await sleep(0.5)
    }
    await page.click(".ml2 > a[url='backNRestore.htm']")
    await sleep(1)
    await page.click("button#resetBtn")
    await sleep(0.25)
    await page.getByRole("button", {name: "Yes"}).click()
    await sleep(1)
    status("Reset to factory defaults success")
    return true
}


async function tpSelectByText(page: Page, id: string, text: string) {
    const xpath = `//*[@id='${id}']//li[text()='${text.replace(/'/, "\\'")}']`
    await page.click(`#${id} > .tp-select`)
    await page.evaluate(xpath => {
        const e = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        // @ts-ignore
        e.scrollIntoView()
    }, xpath)
    await sleep(0.25)
    await page.click(xpath)
    await sleep(0.5)
}

async function tpSelectByVal(page: Page, id: string, val: string) {
    const selector = `#${id} li[data-val='${val.replace(/'/, "\\'")}']`
    await page.click(`#${id} > .tp-select`)
    await page.evaluate(selector => {
        document.querySelector(selector)!.scrollIntoView()
    }, selector)
    await sleep(0.25)
    await page.click(selector)
    await sleep(0.5)

}

async function toggleRadioButtonTo(page: Page, id: string, state: boolean) {
    const isOn = await page.locator("#" + id).evaluate(el => el.classList.contains("on"))
    if (isOn !== state) {
        await page.click("#" + id + " div.button-group-wrap")
        await waitForMaskOff(page)
    }
}

async function waitForMaskOff(page: Page, timeout: number = 60000) {
    const _f = async () => {
        while (await page.locator("div#mask").isHidden()) await sleep(0.05)
        let i = 0;
        while (true) {
            await sleep(0.05)
            if (await page.isVisible("div#mask"))
                i = 0
            else
                i++
            if (i >= 10) break
        }
    }
    return Promise.race([_f(), new Promise((_, reject) => {
        setTimeout(() => {
            reject("waitForMaskOff timeout")
        }, timeout)
    })])
}
