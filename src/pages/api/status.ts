import type {NextApiRequest, NextApiResponse} from "next";
import {ErrorMessage, ProvisioningDevice, ProvisioningStateOrError} from "@/types";
import {state} from "@/pages/api/provision";
import {checkApiKey} from "@/checkApiKey";

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ProvisioningStateOrError | ErrorMessage>
) {
    if (!checkApiKey(req, res)) {
        return
    }
    if (req.method === 'GET') {
        res.status(200).json(state)
    } else if (req.method === 'DELETE') {
        const device: ProvisioningDevice | string | string[] | undefined = req.query.device
        if (device === "router") {
            if (state.router.status === "success" || state.router.status === "error") {
                state.router = {status: "idle"}
                return res.status(200).json(state)
            } else {
                return res.status(400).json(state)
            }
        } else if (device === 'cpe') {
            if (state.cpe.status === "success" || state.cpe.status === "error") {
                state.cpe = {status: "idle"}
                return res.status(200).json(state)
            } else {
                return res.status(400).json(state)
            }
        } else if (device === "everything") {
            let success = true
            if (state.cpe.status === "success" || state.cpe.status === "error") {
                state.cpe = {status: "idle"}
                success = true
            }
            if (state.router.status === "success" || state.router.status === "error") {
                state.router = {status: "idle"}
                success = true
            }
            return res.status(success ? 200 : 400).json(state)
        } else {
            return res.status(400).json({error: "invalid device"})
        }
    } else {
        res.status(400).json({error: "invalid method"})
    }
}