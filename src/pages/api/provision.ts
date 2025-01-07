import type {NextApiRequest, NextApiResponse} from 'next'
import {
    checkProvisioningData,
    ProvisioningData,
    ProvisioningDevice,
    ProvisioningState,
    ProvisioningStateOrError
} from "@/types";
import {checkApiKey} from "@/checkApiKey";
import {printLabel} from "@/pages/api/label";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import * as readline from "node:readline";
import * as os from "node:os";


export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ProvisioningStateOrError>
) {
    if (!checkApiKey(req, res)) {
        return
    }
    if (req.method === 'POST') {
        const device: ProvisioningDevice | string | string[] | undefined = req.query.device
        const data = checkProvisioningData(req.body)
        if (!data) {
            return res.status(400).json({error: "invalid input data"})
        }
        if (device === "router" || device === "everything") {
            if (state.router.status === "idle") {
                provisionRouter(data)
            }
        }
        if (device === "cpe" || device === "everything") {
            if (state.cpe.status === "idle") {
                provisionCPE(data)
            }
        }
        return res.status(200).json(state)
    } else if (req.method === "DELETE") {
        const device: ProvisioningDevice = req.query.device as ProvisioningDevice
        try {
            cancelProvisioning(device)
            return res.status(202).json(state)
        } catch (e) {
            // @ts-ignore
            return res.status(400).json({error: e.message ?? e})
        }
    }
    return res.status(400).json({error: "invalid method"})
}

export let state: ProvisioningState = {
    cpe: {
        status: "idle"
    },
    router: {
        status: "idle"
    }
}
let _routerProcess: ChildProcessWithoutNullStreams | undefined
let _cpeProcess: ChildProcessWithoutNullStreams | undefined

function cancelProvisioning(device: ProvisioningDevice) {
    const cpe = device === "cpe" || device === "everything"
    const router = device === "router" || device === "everything"
    if (cpe && state.cpe.status !== "provisioning") throw new Error("cpe not provisioning")
    if (router && state.router.status !== "provisioning") throw new Error("router not provisioning")
    if (router) {
        _routerProcess?.kill("SIGINT")
    }
    if (cpe) {
        _cpeProcess?.kill("SIGINT")
    }
}

function provisionRouter(data: ProvisioningData) {
    if (state.router.status !== "idle") throw new Error("router not idle")
    state.router = {
        status: "provisioning",
        progress: 0,
        name: data.hostname,
        message: "Starting process...",
    }
    _routerProcess = spawn('npm', ['start', data.hostname, data.ssid, data.psk], {
        cwd: process.cwd() + '/scripts/tplink'
    })
    _routerProcess.stderr.pipe(process.stderr);
    const rl = readline.createInterface({
        input: _routerProcess.stdout,
        crlfDelay: Infinity,
    });
    let i = 0;
    rl.on('line', (line) => {
        if (i++ < 4) return
        try {
            if (state.router.status === "provisioning") {
                const data = JSON.parse(line)
                const {progress, status, error, screenshot} = data
                if (progress !== undefined) state.router.progress = progress
                if (status !== undefined) state.router.message = status
                if (error !== undefined) state.router = {
                    status: "error",
                    name: state.router.name,
                    error: {error, screenshot},
                }
            }
        } catch (e) {
            console.error("Cannot JSON.parse() router process output:", "'" + line + "'")
            // @ts-ignore
            console.error(e.message || e)
        }
    })
    _routerProcess.on('close', (code: number, signal: string | null) => {
        _routerProcess = undefined
        if (state.router.status === 'provisioning') {
            if (code === 0) {
                state.router = {
                    status: "success",
                    name: state.router.name
                }
                printLabel(data, {wifi: true, owner: true})
            } else {
                state.router = {
                    status: "error",
                    name: state.router.name,
                    error: `unknown error: ${code}${signal ? `, signal: ${signal}` : ''}`
                }
            }
        }
    })
}

function provisionCPE(data: ProvisioningData) {
    if (state.cpe.status !== "idle") throw new Error("router not idle")
    state.cpe = {
        status: "provisioning",
        progress: 0,
        name: data.hostname,
        message: "Starting process...",
    }
    _cpeProcess = spawn(os.homedir() + '/.local/bin/poetry', ['run', 'python', '-u', 'main.py', data.hostname, data.lat + "", data.lon + ""], {
        cwd: process.cwd() + '/scripts/ltu'
    })
    _cpeProcess.stderr.pipe(process.stderr);
    const rl = readline.createInterface({
        input: _cpeProcess.stdout,
        crlfDelay: Infinity,
    });
    console.log('spawned')
    rl.on('line', (line) => {
        try {
            if (state.cpe.status === "provisioning") {
                const data = JSON.parse(line)
                const {progress, status, error, screenshot} = data
                if (progress !== undefined) state.cpe.progress = progress
                if (status !== undefined) state.cpe.message = status
                if (error !== undefined) state.cpe = {
                    status: "error",
                    name: state.cpe.name,
                    error: {error, screenshot},
                }
            }
        } catch (e) {
            console.error("Cannot JSON.parse() cpe process output:", "'" + line + "'")
            // @ts-ignore
            console.error(e.message || e)
        }
    })
    _cpeProcess.on('close', (code: number, signal: string | null) => {
        _cpeProcess = undefined
        if (state.cpe.status === 'provisioning') {
            if (code === 0) {
                state.cpe = {
                    status: "success",
                    name: state.cpe.name
                }
                printLabel(data, {owner: true})
            } else {
                state.cpe = {
                    status: "error",
                    name: state.cpe.name,
                    error: `unknown error: ${code}${signal ? `, signal: ${signal}` : ''}`
                }
            }
        }
    })
}