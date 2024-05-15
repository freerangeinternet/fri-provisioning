import {Button, Row} from "react-bootstrap";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import {ProvisioningMainMenuAction} from "@/components/ProvisioningComponent";
import {useState} from "react";
import {ProvisioningDevice, ProvisioningState} from "@/types";

interface ProvisioningMainMenuProps {
    provisioningState?: ProvisioningState
    clickHandler?: (action: ProvisioningMainMenuAction, device: ProvisioningDevice | null) => void
}

function useHover(): [boolean, {}] {
    const [hovering, setHovering] = useState(false)
    const onHoverProps = {
        onMouseEnter: () => setHovering(true),
        onMouseLeave: () => setHovering(false),
    }
    return [hovering, onHoverProps]
}

const ProvisioningMainMenu: React.FC<ProvisioningMainMenuProps> = ({provisioningState, clickHandler}: ProvisioningMainMenuProps) => {
    const {router, cpe} = provisioningState ?? {}
    let routerStatus = false, cpeStatus = false, routerProgress = "", cpeProgress = ""
    if (router?.status === "provisioning") {
        routerStatus = true
        routerProgress = (router.progress * 100).toFixed(0)
    }
    if (cpe?.status === "provisioning") {
        cpeStatus = true
        cpeProgress = (cpe.progress * 100).toFixed(0)
    }
    const [everythingHovering, everythingHoverProps] = useHover()
    const [routerHovering, routerHoverProps] = useHover()
    const [cpeHovering, cpeHoverProps] = useHover()
    return (
        <>
            <Container as="main">
                <Row className="w-100 align-items-center mb-5">
                    <Col className="col-12">
                        <Button variant={routerStatus || cpeStatus ? "danger" : "warning"}
                                className="w-100"
                                {...everythingHoverProps}
                                disabled={true}
                                onClick={() => (routerStatus || cpeStatus) ? clickHandler!("cancel", "everything") : clickHandler!("provision", "everything")}
                        >{(routerStatus || cpeStatus) ? (everythingHovering) ? "Cancel" : "Provisioning in progress" : "Provision Everything"}</Button>
                    </Col>
                </Row>
                <Row className="w-100 align-items-center mb-5">
                    <Col className="col-6">
                        <Button
                            variant={routerStatus ? 'danger' : 'primary'}
                            className="w-100"
                            {...routerHoverProps}
                            onClick={() => (routerStatus) ? clickHandler!("cancel", "router") : clickHandler!("provision","router")}
                        >{routerStatus ? (routerHovering ? "Cancel " : "") + "Router (" + routerProgress + "%)" : "Provision Router"}</Button>
                    </Col>
                    <Col className="col-6">
                        <Button
                            variant={cpeStatus ? "danger" : "primary"}
                            className="w-100"
                            disabled={true}
                            {...cpeHoverProps}
                            onClick={() => (cpeStatus) ? clickHandler!("cancel", "cpe") : clickHandler!("provision", "cpe")}
                        >{cpeStatus ? (cpeHovering ? "Cancel " : "") + "CPE (" + cpeProgress + "%)" : "Provision CPE"}</Button>
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