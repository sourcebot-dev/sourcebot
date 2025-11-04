import { getAuthProviderInfo } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderIcon } from "./components/providerIcon";
import { ProviderInfo } from "./components/providerInfo";
import { UnlinkButton } from "./unlinkButton";
import { LinkButton } from "./linkButton";
import { IntegrationIdentityProviderState } from "@/ee/features/permissionSyncing/types"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

interface IntegrationProviderCardProps {
    integrationProviderState: IntegrationIdentityProviderState;
    callbackUrl?: string;
}

export function IntegrationProviderCard({
    integrationProviderState,
    callbackUrl,
}: IntegrationProviderCardProps) {
    const providerInfo = getAuthProviderInfo(integrationProviderState.id);
    const defaultCallbackUrl = `/${SINGLE_TENANT_ORG_DOMAIN}/settings/permission-syncing`;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                            <ProviderIcon
                                icon={providerInfo.icon}
                                displayName={providerInfo.displayName}
                                size="lg"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                            <CardTitle className="text-base">
                                <ProviderInfo
                                    providerId={integrationProviderState.id}
                                    required={integrationProviderState.required}
                                    showBadge={true}
                                />
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {integrationProviderState.isLinked? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                            <span className="text-green-600 dark:text-green-500 font-medium">
                                                Connected
                                            </span>
                                        </div>
                                        {integrationProviderState.linkedAccountId && (
                                            <>
                                                <span className="text-muted-foreground">•</span>
                                                <span className="text-muted-foreground font-mono truncate">
                                                    {integrationProviderState.linkedAccountId}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                            Not connected
                                        </span>
                                    </div>
                                )}
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                        {integrationProviderState.isLinked? (
                            <UnlinkButton
                                provider={integrationProviderState.id}
                                providerName={providerInfo.displayName}
                            />
                        ) : (
                            <LinkButton
                                provider={integrationProviderState.id}
                                callbackUrl={callbackUrl ?? defaultCallbackUrl}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

