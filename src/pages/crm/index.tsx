import Head from "next/head";
import Container from "react-bootstrap/Container";
import ProvisioningComponent from "@/components/ProvisioningComponent";
import {useRouter} from "next/router";
import {checkProvisioningData, ProvisioningData} from "@/types";
import {Alert} from "react-bootstrap";
import JSONDump from "@/components/JSONDump";

export let apikey: string

export default function Crm() {
    const router = useRouter()
    apikey = router.query.apikey as string
    const data = checkProvisioningData(router.query)
    return (
        <>
            <Head>
                <title>FRI-Provisioning CRM module</title>
            </Head>
            <Container as="main">
                {data ?
                    <>
                        <ProvisioningComponent data={data as ProvisioningData} />
                    </> :
                    <>
                        <Alert variant={"danger"}>Invalid provisioning data</Alert>
                        <JSONDump json={router.query}/>
                    </>
                }
            </Container>
        </>
    );
}
