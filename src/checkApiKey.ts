import {NextApiRequest, NextApiResponse} from "next";

export function checkApiKey(req: NextApiRequest, res: NextApiResponse) {
    const apikeys = process.env.API_KEYS
    if (apikeys === undefined) {
        res.status(500).json({error: "missing API_KEY environment variable"})
        return false
    }
    if (typeof req.query.apikey !== "string") {
        res.status(401).json({error: "missing ?apikey="})
        return false
    }
    if (req.query.apikey.length === 0) {
        res.status(401).json({error: "invalid api key"})
        return false
    }
    if (!apikeys.split(",").includes(req.query.apikey)) {
        res.status(401).json({error: "invalid api key"})
        return false
    }
    return true
}