import {Button, Row} from "react-bootstrap";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import {LabelStatus, ProvisioningMainMenuAction} from "@/components/ProvisioningComponent";
import {ProvisioningDevice, ProvisioningState} from "@/types";

interface ProvisioningMainMenuProps {
    provisioningState?: ProvisioningState
    clickHandler?: (action: ProvisioningMainMenuAction, device: ProvisioningDevice | null) => void
    labelStatus?: LabelStatus
}

const ProvisioningMainMenu: React.FC<ProvisioningMainMenuProps> = ({provisioningState, clickHandler, labelStatus}: ProvisioningMainMenuProps) => {
    const {router, cpe} = provisioningState ?? {}
    let routerProgress = "", cpeProgress = "", routerMessage = "", cpeMessage = "", routerStatus = false, cpeStatus = false
    if (router?.status === "provisioning") {
        routerProgress = `Provisioning router for ${router.name} (${(router.progress).toFixed(0)}%)`
        routerMessage = router.message
        routerStatus = true
    }
    if (cpe?.status === "provisioning") {
        cpeProgress = `Provisioning cpe for ${cpe.name} (${((cpe.progress).toFixed(0))}%)`
        cpeMessage = cpe.message
        cpeStatus = true
    }
    return (
        <>
            <Container as="main">
                <Row className="w-100 align-items-center mb-3">
                    <Col className="col-12">
                        <Button variant={routerStatus || cpeStatus ? "danger" : "warning"}
                                className="w-100"
                                disabled={true}
                                onClick={() => (routerStatus || cpeStatus) ? clickHandler!("cancel", "everything") : clickHandler!("provision", "everything")}
                        >{(routerStatus || cpeStatus) ? "Cancel everything" : "Provision Everything"}</Button>
                    </Col>
                </Row>
                <Row className="w-100 align-items-center mb-3">
                    <Col className="col-6">
                        <Button
                            variant={routerStatus ? 'danger' : 'primary'}
                            className="w-100"
                            onClick={() => (routerStatus) ? clickHandler!("cancel", "router") : clickHandler!("provision","router")}
                        >{(routerStatus ? "Cancel Router" : "Provision Router")}</Button>
                    </Col>
                    <Col className="col-6">
                        <Button
                            variant={cpeStatus ? "danger" : "primary"}
                            className="w-100"
                            onClick={() => (cpeStatus) ? clickHandler!("cancel", "cpe") : clickHandler!("provision", "cpe")}
                        >{(cpeStatus ? "Cancel CPE" : "Provision CPE")}</Button>
                    </Col>
                </Row>
                <Row className="w-100 align-items-center mb-3">
                    <Col className="col-6">
                        <div>{routerProgress}</div>
                        <div>{routerMessage}</div>
                    </Col>
                    <Col className="col-6">
                        <div>{cpeProgress}</div>
                        <div>{cpeMessage}</div>
                    </Col>
                </Row>
                <Row className="w-100 align-items-center mb-3">
                    <Col className="col-6">
                        <Button
                            variant={labelStatus === "success" ? "success": "secondary"}
                            className="w-100"
                            disabled={labelStatus === "requested"}
                            onClick={() => clickHandler!("label","router")}
                        >Print Router labels</Button>
                    </Col>
                    <Col className="col-6">
                        <Button
                            variant={labelStatus === "success" ? "success": "secondary"}
                            className="w-100"
                            disabled={labelStatus === "requested"}
                            onClick={() => clickHandler!("label", "cpe")}
                        >Print CPE labels</Button>
                    </Col>
                </Row>
                <Row className="w-100 align-items-center">
                    <Col className="col-12">
                        <Button variant="info" className="w-100"
                                onClick={() => clickHandler!("matrix", null)}
                        >View CPE Matrix</Button>
                    </Col>
                </Row>
            </Container>
        </>
    )
}

export default ProvisioningMainMenu;