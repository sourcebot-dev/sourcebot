import { getAuthProviderInfo } from "@/lib/utils";
import { Check, X, AlertCircle } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderIcon } from "./providerIcon";
import { ProviderInfo } from "./providerInfo";
import { UnlinkButton } from "./unlinkButton";
import { LinkButton } from "./linkButton";
import { LinkedAccountProviderState } from "@/ee/features/permissionSyncing/types"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

interface LinkedAccountProviderCardProps {
    linkedAccountProviderState: LinkedAccountProviderState;
    callbackUrl?: string;
}

export function LinkedAccountProviderCard({
    linkedAccountProviderState,
    callbackUrl,
}: LinkedAccountProviderCardProps) {
    const providerInfo = getAuthProviderInfo(linkedAccountProviderState.id);
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
                                    providerId={linkedAccountProviderState.id}
                                    required={linkedAccountProviderState.required}
                                    showBadge={true}
                                />
                            </CardTitle>
                            <CardDescription className="text-xs">
                                <div className="flex flex-col gap-1.5">
                                    {linkedAccountProviderState.isLinked? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                                <span className="text-green-600 dark:text-green-500 font-medium">
                                                    Connected
                                                </span>
                                            </div>
                                            {linkedAccountProviderState.linkedAccountId && (
                                                <>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className="text-muted-foreground font-mono truncate">
                                                        {linkedAccountProviderState.linkedAccountId}
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
                                    {linkedAccountProviderState.error && (
                                        <div className="flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                            <span className="text-destructive font-medium">
                                                Token refresh failed - please reconnect
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                        {linkedAccountProviderState.isLinked? (
                            <UnlinkButton
                                provider={linkedAccountProviderState.id}
                                providerName={providerInfo.displayName}
                            />
                        ) : (
                            <LinkButton
                                provider={linkedAccountProviderState.id}
                                callbackUrl={callbackUrl ?? defaultCallbackUrl}
                            />
                        )}
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

