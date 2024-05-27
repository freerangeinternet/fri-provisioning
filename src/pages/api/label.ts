import {
    checkProvisioningData, ErrorMessage,
    ProvisioningData,
    ProvisioningDevice, StatusMessage,
} from "@/types";
import {parsePhoneNumber} from "libphonenumber-js";
import type {NextApiRequest, NextApiResponse} from "next";
import {checkApiKey} from "@/checkApiKey";

type LabelType = "owner" | "wifi"

export async function printLabel(data: ProvisioningData, types: { [key in LabelType]?: boolean }) {
    let params: any = {}
    if (types.wifi) {
        params.ssid = data.ssid
        params.psk = data.psk
    }
    if (types.owner) {
        params.text = data.displayname + "\n"
        params.text += data.address + "\n"
        params.text += parsePhoneNumber(data.phone, "US")?.formatNational() ?? data.phone
    }
    if (!params) throw new Error("no label types requested")
    const url = process.env["LABEL_URL"] + "/label?" + new URLSearchParams(params).toString()
    const res = await fetch(url)
    if (res.status >= 400) throw new Error(await res.text())
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<StatusMessage | ErrorMessage>
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
        let promise;
        if (device === "router") {
            promise = printLabel(data, {owner: true, wifi: true})
        } else if (device === "cpe") {
            promise = printLabel(data, {owner: true})
        } else {
            return res.status(400).json({error: "invalid device"})
        }
        try {
            await promise
            return res.status(200).json({status: "success"})
        } catch (e) {
            // @ts-ignore
            return res.status(500).json({error: "error from label service: " + (e.message ?? e)})
        }
    }
    return res.status(400).json({error: "invalid method"})
}
