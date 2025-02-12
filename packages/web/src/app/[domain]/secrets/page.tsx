import { NavigationMenu } from "../components/navigationMenu";
import { SecretsTable } from "./secretsTable";
import { isServiceError } from "@/lib/utils";
import { getSecrets } from "@/actions";

export default async function SecretsPage({ params: { domain } }: { params: { domain: string } }) {
    const secrets = await getSecrets(domain);
    
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu domain={domain} />
            { !isServiceError(secrets) && (
                <div className="max-w-[90%]">
                    <SecretsTable
                        initialSecrets={secrets}
                    />
                </div>
            )}
        </div>
    )
}