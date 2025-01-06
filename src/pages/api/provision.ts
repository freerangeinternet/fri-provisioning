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
                return res.status(200).json(state)
            } else {
                return res.status(400).json({error: "router provisioning not idle"})
            }
        } else {
            return res.status(400).json({error: "Not implemented"})
        }
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
let _provisioningProcess: ChildProcessWithoutNullStreams | undefined

function cancelProvisioning(device: ProvisioningDevice) {
    const cpe = device === "cpe" || device === "everything"
    const router = device === "router" || device === "everything"
    if (cpe && state.cpe.status !== "provisioning") throw new Error("cpe not provisioning")
    if (router && state.router.status !== "provisioning") throw new Error("router not provisioning")
    if (router) {
        _provisioningProcess?.kill("SIGKILL")
    }
    if (cpe) {
        state.cpe = {status: "idle"}
    }
}

function provisionRouter(data: ProvisioningData) {
    if (state.router.status !== "idle") throw new Error("router not idle")
    state.router = {
        status: "provisioning",
        progress: 0,
        name: data.hostname,
        message: "waiting for response",
    }
    _provisioningProcess = spawn('npm', ['start', data.hostname, data.ssid, data.psk], {
        cwd: process.cwd() + '/scripts/tplink'
    })
    _provisioningProcess.stderr.pipe(process.stderr);
    const rl = readline.createInterface({
        input: _provisioningProcess.stdout,
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
            console.error("Cannot JSON.parse() tplink process output:", "'" + line + "'")
            // @ts-ignore
            console.error(e.message || e)
        }
    })
    rl.on('close', (code: number) => {
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
                    error: "unknown error: " + code
                }
            }
        }
    })
}