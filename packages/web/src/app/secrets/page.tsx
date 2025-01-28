import { NavigationMenu } from "../components/navigationMenu";
import { SecretsTable } from "./secretsTable";
import { getSecrets } from "../../actions"
import { isServiceError } from "@/lib/utils";

export interface SecretsTableProps {
    initialSecrets: { createdAt: Date; key: string; }[];
}

export default async function SecretsPage() {
    const secrets = await getSecrets();
    
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu />
            { !isServiceError(secrets) && (
                <div className="max-w-[90%]">
                    <SecretsTable initialSecrets={secrets} />
                </div>
            )}
        </div>
    )
}