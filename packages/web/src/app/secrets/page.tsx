import { NavigationMenu } from "../components/navigationMenu";
import { SecretsTable } from "./secretsTable";

export default function SecretsPage() {
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu />
            <div className="max-w-[90%]">
                <SecretsTable />
            </div>
        </div>
    )
}