import {Alert, Button} from "react-bootstrap";
import ProvisioningMainMenu from "@/components/ProvisioningMainMenu";
import {useEffect, useState} from "react";
import {
    ErrorMessage, isErrorMessage,
    ProvisioningData,
    ProvisioningDevice,
    ProvisioningStateOrError
} from "@/types";
import {HTTP_METHOD} from "next/dist/server/web/http";
import ProvisioningStatus from "@/components/ProvisioningStatus";
import {SoundEffectPlayer} from "@/player";
import {apikey} from "@/pages/crm";


export type ProvisioningMainMenuAction = "provision" | "matrix" | "cancel"
type Menu = "main" | "matrix"

interface ProvisioningComponentProps {
    data?: ProvisioningData
}

const soundEffectPlayer = new SoundEffectPlayer()

const ProvisioningComponent: React.FC<ProvisioningComponentProps> = ({data}: ProvisioningComponentProps) => {
    const [provisioningState, setPS] = useState<ProvisioningStateOrError>()
    const setProvisioningState = (s: ProvisioningStateOrError) => {
        setPS(s)
        if (isErrorMessage(s)) return
        soundEffectPlayer.handle(s)
    }
    const [menu, setMenu] = useState<Menu>("main")
    const updateProvisioningState = () => {
        getProvisioningStatus().then(s => {
            if (JSON.stringify(s) !== JSON.stringify(provisioningState)) setProvisioningState(s)
        })
    }
    useEffect(() => {
        updateProvisioningState()
        const i = setInterval(() => {
            if (menu === 'main') {
                console.log("updateProvisioningState")
                updateProvisioningState()
            }
        }, 1000)
        return () => {
            console.log("clearInterval")
            clearInterval(i)
        }
    })
    if (isErrorMessage(provisioningState)) {
        return (
            <>
                <Alert variant={"danger"}>Cannot get status: {provisioningState.error}</Alert>
            </>
        )
    }
    if (menu === 'main') {
        if (
            provisioningState?.cpe?.status === "success" ||
            provisioningState?.cpe?.status === "error" ||
            provisioningState?.router?.status === "success" ||
            provisioningState?.router?.status === "error"
        ) {
            return (
                <>
                    <ProvisioningStatus provisioningState={provisioningState} setProvisioningState={setProvisioningState}/>
                </>
            )
        }
        async function clickHandler(action: ProvisioningMainMenuAction, device: ProvisioningDevice | null) {
            if (action === "matrix") {
                setMenu("matrix")
            } else if (action === "cancel") {
                const state = await cancelProvisioning(device!)
                if (isErrorMessage(state)) {
                    alert(state.error)
                } else {
                    setProvisioningState(state)
                }
            } else if (action === "provision") {
                const state = await requestProvisioning(data!, device!)
                if (isErrorMessage(state)) {
                    alert(state.error)
                } else {
                    setProvisioningState(state)
                }
                console.log(state)
            }
        }

        return (
            <>
                <ProvisioningMainMenu provisioningState={provisioningState} clickHandler={clickHandler}/>
            </>
        );
    } else if (menu === 'matrix') {
        return (
            <>
                <Alert variant={"warning"}>Matrix provisioning is not implemented</Alert>
                <Button variant={"primary"} onClick={() => setMenu("main")}>Back</Button>
            </>
        )
    }
};

async function _request(url: string, method: HTTP_METHOD, data?: any): Promise<ProvisioningStateOrError | ErrorMessage> {
    const d = await fetch(url, {
        method: method,
        headers: {
            "Content-Type": "application/json"
        },
        body: data ? JSON.stringify(data) : undefined,
    })
    const json = await d.json()
    if (d.status >= 400 && !json.error) {
        return {error: d.statusText}
    }
    return json
}

export async function cancelProvisioning(device: ProvisioningDevice): Promise<ProvisioningStateOrError | ErrorMessage> {
    return _request("/api/provision?apikey=" + apikey + "&device=" + device, "DELETE")
}

async function requestProvisioning(data: ProvisioningData, device: ProvisioningDevice): Promise<ProvisioningStateOrError | ErrorMessage> {
    soundEffectPlayer.reset(device)
    return _request("/api/provision?apikey=" + apikey + "&device=" + device, "POST", data)
}

async function getProvisioningStatus(): Promise<ProvisioningStateOrError | ErrorMessage> {
        return _request("/api/status?apikey=" + apikey, "GET")
}

export async function clearStatus(device: ProvisioningDevice): Promise<ProvisioningStateOrError | ErrorMessage> {
    return _request("/api/status?apikey=" + apikey + "&device=" + device, "DELETE")
}

export default ProvisioningComponent;