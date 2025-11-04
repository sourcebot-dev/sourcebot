import { ShieldCheck } from "lucide-react";
import { getIntegrationProviderStates } from "@/ee/features/permissionSyncing/actions"
import { Card, CardContent } from "@/components/ui/card";
import { IntegrationProviderCard } from "./integrationProviderCard";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { isServiceError } from "@/lib/utils";

export async function LinkedAccountsSettings() {
    const integrationProviderStates = await getIntegrationProviderStates();
    if (isServiceError(integrationProviderStates)) {
        return <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md w-full text-center">
                <h2 className="text-lg font-semibold text-red-800 mb-2">An error occurred</h2>
                <p className="text-red-700 mb-1">
                    {typeof integrationProviderStates.message === 'string'
                        ? integrationProviderStates.message
                        : "A server error occurred while checking your account status. Please try again or contact support."}
                </p>
            </div>
        </div>
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Linked Accounts</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your linked account integrations for permission syncing.
                </p>
            </div>

            {integrationProviderStates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-muted p-3 mb-4">
                            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">No integration providers configured</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Contact your administrator to configure integration providers for your organization.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {integrationProviderStates
                        .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
                        .map((state) => {
                            return (
                                <IntegrationProviderCard
                                    key={state.id}
                                    integrationProviderState={state}
                                />
                            );
                        })}
                </div>
            )}
        </div>
    );
}
