import type {NextApiRequest, NextApiResponse} from 'next'
import {
    checkProvisioningData,
    ProvisioningData,
    ProvisioningDevice,
    ProvisioningState,
    ProvisioningStateOrError
} from "@/types";
import {checkApiKey} from "@/checkApiKey";


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
        if (device === "router") {
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

setInterval(() => {
    if (state.cpe.status === "provisioning") {
        if (state.cpe.progress < 0.99)
            state.cpe.progress += 0.01
    }
    if (state.router.status === "provisioning") {
        if (state.router.progress < 0.99)
            state.router.progress += 0.01
    }
}, 1000)

function cancelProvisioning(device: ProvisioningDevice) {
    const cpe = device === "cpe" || device === "everything"
    const router = device === "router" || device === "everything"
    if (cpe && state.cpe.status !== "provisioning") throw new Error("cpe not provisioning")
    if (router && state.router.status !== "provisioning") throw new Error("router not provisioning")
    if (router) {
        fetch("http://tplink:7201/provision", {
            method: "DELETE"
        })
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
        name: data.hostname
    }
    const query = fetch("http://tplink:7201/provision", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    query.then(async (result) => {
        if (result.status === 202) {}
        else if (result.status < 400)
            state.router = {
                status: "success",
                name: data.hostname
            }
        else {
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