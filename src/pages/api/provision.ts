import type {NextApiRequest, NextApiResponse} from 'next'
import {
    checkProvisioningData,
    ProvisioningData,
    ProvisioningDevice,
    ProvisioningState,
    ProvisioningStateOrError
} from "@/types";


export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ProvisioningStateOrError>
) {
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
        const device: ProvisioningDevice | string | string[] | undefined = req.query.device
        if (device === "router") {
            if (state.router.status === "idle") {
                return res.status(400).json({error: "router not being provisioned"})
            } else {
                state.router = {status: "idle"}
                return res.status(200).json(state)
            }
        } else if (device === "everything") {
            if (state.cpe.status === "idle" && state.router.status === "idle") {
                return res.status(400).json({error: "not being provisioned"})
            } else {
                state.cpe = {status: "idle"}
                state.router = {status: "idle"}
                return res.status(200).json(state)
            }
        } else {
            return res.status(400).json({error: "invalid device"})
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

function provisionRouter(data: ProvisioningData) {
    if (state.router.status !== "idle") throw new Error("router not idle")
    state.router = {
        status: "provisioning",
        progress: 0,
        name: data.hostname
    }
    const query = fetch("http://localhost:7201/provision", {
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
            state.router = {
                status: "error",
                error: await result.text(),
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