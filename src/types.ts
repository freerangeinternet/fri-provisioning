export type ProvisioningStateOrError = ProvisioningState | ErrorMessage
export type ProvisioningState = {
    cpe: CPEProvisioningState
    router: RouterProvisioningState
}
export type ErrorMessage = {
    error: string
}
export const isErrorMessage = (state?: ProvisioningStateOrError): state is ErrorMessage => {
    return state !== undefined && (state as ErrorMessage).error !== undefined;
};

export type CPEProvisioningState = {
    status: "idle"
} | {
    status: "provisioning"
    name: string
    progress: number
} | {
    status: "success"
    name: string
} | {
    status: "error"
    name: string
    error: string
}

export type RouterProvisioningState = CPEProvisioningState
export type ProvisioningDevice = "everything" | "router" | "cpe"
export type ProvisioningData = {
    address: string
    lat: number
    lon: number
    plan: string
    hostname: string
    ssid: string
    psk: string
}
export function checkProvisioningData(data: ProvisioningData | any): ProvisioningData | false {
    if (typeof data !== 'object')
        return false
    if (typeof data.address !== 'string')
        return false
    if (typeof data.lat !== "number") {
        if (typeof data.lat !== "string")
            return false
        data.lat = Number.parseFloat(data.lat);
        if (Number.isNaN(data.lat))
            return false
    }
    if (typeof data.lon !== "number") {
        if (typeof data.lon !== "string")
            return false
        data.lat = Number.parseFloat(data.lon)
        if (Number.isNaN(data.lon))
            return false
    }
    if (typeof data.plan !== 'string')
        return false
    if (typeof data.hostname !== 'string')
        return false
    if (typeof data.ssid !== 'string')
        return false
    if (typeof data.psk !== 'string')
        return false
    return data
}