import {
    CPEProvisioningState,
    ProvisioningState,
    ProvisioningStateError,
    ProvisioningStateOrError,
    RouterProvisioningState
} from "@/types";
import {Alert} from "react-bootstrap";
import {clearStatus} from "@/components/ProvisioningComponent";

interface ProvisioningStatusProps {
    provisioningState?: ProvisioningState
    setProvisioningState?: (s: ProvisioningStateOrError) => void
}

const ProvisioningStatus: React.FC<ProvisioningStatusProps> = ({
                                                                   provisioningState,
                                                                   setProvisioningState
                                                               }: ProvisioningStatusProps) => {
    let {router, cpe} = provisioningState!
    const clearRouter = () => {
        clearStatus("router").then(s => setProvisioningState!(s))
    }
    const clearCPE = () => {
        clearStatus("cpe").then(s => setProvisioningState!(s))
    }

    return [getPopup(router, clearRouter), getPopup(cpe, clearCPE)]
}

function getPopup(state: CPEProvisioningState | RouterProvisioningState, clearCallback: () => void) {
    if (state.status === "success" || state.status === "error") {
        const success = state.status === "success"
        return (
            <>
                <Alert variant={success ? "success" : "danger"} className={"alert-dismissible"}>
                    {success ?
                        <>Router provisioned for <strong>{state.name}</strong></> :
                        [
                            <>Error provisioning router for <strong>{state.name}</strong></>,
                            renderError(state.error),
                        ]
                    }
                    <button type={"button"} className={"btn-close"} data-bs-dismiss={"alert"} aria-label={"Close"}
                            onClick={clearCallback}/>
                </Alert>
            </>
        )
    }
    return null
}

function renderError(error: ProvisioningStateError) {
    let res = []
    if (typeof error === 'string') res.push(<>
        <pre>{error}</pre>
    </>)
    else {
        res.push(<>
            <pre>{error.error}</pre>
        </>)
        if (error.screenshot) res.push(<><img width='100%' src={'data:image/png;base64,' + error.screenshot}></img></>)
    }
    return res
}

export default ProvisioningStatus;