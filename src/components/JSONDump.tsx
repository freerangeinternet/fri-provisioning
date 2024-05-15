
interface JSONDumpProps {
    json: any
}

const JSONDump: React.FC<JSONDumpProps> = ({json}: JSONDumpProps) => {
    return (
        <>
            <div><pre>{JSON.stringify(json, null, 2)}</pre></div>
        </>
    )
}

export default JSONDump;
