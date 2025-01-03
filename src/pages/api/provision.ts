import type {NextApiRequest, NextApiResponse} from 'next'
import {
    checkProvisioningData,
    ProvisioningData,
    ProvisioningDevice,
    ProvisioningState,
    ProvisioningStateOrError
} from "@/types";
import {checkApiKey} from "@/checkApiKey";
import {io} from "socket.io-client";
import {printLabel} from "@/pages/api/label";


export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ProvisioningStateOrError>
) {
    if (!checkApiKey(req, res)) {
        return
    }
    if (req.method === 'POST') {
        const device: ProvisioningDevice | string | string[] | undefined = req.query.device
        const callbackURL: string | undefined = req.query.callbackURL as string | undefined
        const data = checkProvisioningData(req.body)
        if (!data) {
            return res.status(400).json({error: "invalid input data"})
        }
        if (device === "router" || device === "everything") {
            if (state.router.status === "idle") {
                provisionRouter(data, callbackURL)
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
let _provisioningData: ProvisioningData | undefined

const tplinkSocket = io(process.env.TPLINK_URL!)
tplinkSocket.on("status", (data) => {
    let name = state.router.status === "idle" ? "unknown" : state.router.name
    if (data.error) {
        state.router = {
            status: "error",
            name,
            error: {error: data.error, screenshot: data.screenshot},
        }
    } else if (data.progress === 100) {
        state.router = {
            status: "success",
            name,
        }
        if (_provisioningData !== undefined)
            printLabel(_provisioningData, {owner: true, wifi: true})
        _provisioningData = undefined
    } else if (data.progress !== undefined) {
        state.router = {
            status: "provisioning",
            name,
            progress: data.progress,
            message: data.status,
        }
    }
})

function cancelProvisioning(device: ProvisioningDevice) {
    const cpe = device === "cpe" || device === "everything"
    const router = device === "router" || device === "everything"
    if (cpe && state.cpe.status !== "provisioning") throw new Error("cpe not provisioning")
    if (router && state.router.status !== "provisioning") throw new Error("router not provisioning")
    if (router) {
        fetch(process.env.TPLINK_URL + "/provision", {
            method: "DELETE"
        })
    }
    if (cpe) {
        state.cpe = {status: "idle"}
    }
}

function provisionRouter(data: ProvisioningData, callbackURL: string | undefined) {
    if (state.router.status !== "idle") throw new Error("router not idle")
    state.router = {
        status: "provisioning",
        progress: 0,
        name: data.hostname,
        message: "waiting for response",
    }
    const query = fetch(process.env.TPLINK_URL + "/provision?" + new URLSearchParams({callbackURL} as Record<string, string>), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    _provisioningData = data
    query.then(async (result) => {
        if (result.status === 202) {}
        else if (result.status < 400) {
            state.router = {
                status: "success",
                name: data.hostname
            }
            printLabel(data, {wifi: true, owner: true})
            _provisioningData = undefined
        } else {
            const contentType = result.headers.get("content-type");
            const error = contentType && contentType.includes("json") ? await result.json() : await result.text()
            state.router = {
                status: "error",
                error,
                name: data.hostname,
            }
        }
        }, (error) => {
            state.router = {
                status: "error",
                error: error.message || error,
                name: data.hostname,
            }
        }
    )
}