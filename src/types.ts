export type ProvisioningStateOrError = ProvisioningState | ErrorMessage
export type ProvisioningState = {
    cpe: CPEProvisioningState
    router: RouterProvisioningState
}
export type ErrorMessage = {
    error: string
}
export type StatusMessage = {
    status: string
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
    message: string
} | {
    status: "success"
    name: string
} | {
    status: "error"
    name: string
    error: ProvisioningStateError
}

export type ProvisioningStateError = string | { error: string, screenshot?: string }

export type RouterProvisioningState = CPEProvisioningState
export type ProvisioningDevice = "everything" | "router" | "cpe"
export type ProvisioningData = {
    address: string
    lat: number
    lon: number
    plan: string
    hostname: string
    displayname: string
    phone: string
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
        data.lon = Number.parseFloat(data.lon)
        if (Number.isNaN(data.lon))
            return false
    }
    if (typeof data.plan !== 'string')
        return false
    if (typeof data.hostname !== 'string')
        return false
    data.hostname = data.hostname.normalize('NFD').replace(/[\u0300-\u036f'",.#]/g, '').replace(/\s/g, "_");
    if (!/^[a-zA-Z0-9]([\-_a-zA-Z0-9]*[a-zA-Z0-9])?$/.test(data.hostname)) {
        return false
    }
    if (typeof data.displayname !== 'string')
        return false
    if (typeof data.phone !== 'string')
        return false
    if (typeof data.ssid !== 'string')
        return false
    if (typeof data.psk !== 'string')
        return false
    return data
}