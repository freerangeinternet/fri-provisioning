import {CPEProvisioningState, ProvisioningState, ProvisioningStateOrError, RouterProvisioningState} from "@/types";
import {Alert} from "react-bootstrap";
import {cancelProvisioning} from "@/components/ProvisioningComponent";

interface ProvisioningStatusProps {
    provisioningState?: ProvisioningState
    setProvisioningState?: (s: ProvisioningStateOrError) => void
}

const ProvisioningStatus: React.FC<ProvisioningStatusProps> = ({provisioningState, setProvisioningState}: ProvisioningStatusProps) => {
    let {router, cpe} = provisioningState!
    const clearRouter = () => {
        cancelProvisioning("router").then(s =>  setProvisioningState!(s))
    }
    const clearCPE = () => {
        cancelProvisioning("cpe").then(s =>  setProvisioningState!(s))
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
                        <>Error provisioning router for <strong>{state.name}</strong>
                            <div dangerouslySetInnerHTML={{__html: state.error}}></div>
                        </>
                    }
                    <button type={"button"} className={"btn-close"} data-bs-dismiss={"alert"} aria-label={"Close"}
                            onClick={clearCallback}/>
                </Alert>
            </>
        )
    }
    return <></>
}

export default ProvisioningStatus;