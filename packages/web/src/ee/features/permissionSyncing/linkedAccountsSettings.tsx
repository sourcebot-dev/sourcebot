import { withAuthV2 } from "@/withAuthV2";
import { sew } from "@/actions";
import { isServiceError, getAuthProviderInfo } from "@/lib/utils";
import { loadConfig } from "@sourcebot/shared";
import { env } from "@/env.mjs";
import { Check, X, ShieldCheck } from "lucide-react";
import { getUnlinkedIntegrationProviders } from "./actions";
import { UnlinkButton } from "./unlinkButton";
import { LinkButton } from "./linkButton";
import { ServiceErrorException } from "@/lib/serviceError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderIcon } from "./components/providerIcon";
import { ProviderInfo } from "./components/providerInfo";

interface LinkedAccountsSettingsProps {
    domain: string;
}

export async function LinkedAccountsSettings({ domain }: LinkedAccountsSettingsProps) {
    const config = await loadConfig(env.CONFIG_PATH);
    const integrationProviders = (config.identityProviders ?? [])
        .filter(provider => provider.purpose === "integration");

    // Get user's linked accounts
    const getLinkedAccounts = async () => sew(() =>
        withAuthV2(async ({ prisma, user }) => {
            const accounts = await prisma.account.findMany({
                where: {
                    userId: user.id,
                    provider: {
                        in: integrationProviders.map(p => p.provider)
                    }
                },
                select: {
                    provider: true,
                    providerAccountId: true,
                }
            });
            return accounts;
        })
    );

    const linkedAccountsResult = await getLinkedAccounts();
    if (isServiceError(linkedAccountsResult)) {
        throw new ServiceErrorException(linkedAccountsResult);
    }

    const linkedAccounts = linkedAccountsResult;

    const unlinkedProvidersResult = await getUnlinkedIntegrationProviders();
    if (isServiceError(unlinkedProvidersResult)) {
        throw new ServiceErrorException(unlinkedProvidersResult);
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Linked Accounts</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your linked integration accounts for permission syncing and code host access.
                </p>
            </div>

            {/* Show linked accounts as separate cards */}
            {integrationProviders.length === 0 ? (
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
                    {integrationProviders.map((provider) => {
                        const providerInfo = getAuthProviderInfo(provider.provider);
                        const linkedAccount = linkedAccounts.find(
                            account => account.provider === provider.provider
                        );
                        const isLinked = !!linkedAccount;
                        const isRequired = 'required' in provider ? (provider.required as boolean) : true;

                        return (
                            <Card key={provider.provider}>
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
                                                        providerId={provider.provider}
                                                        required={isRequired}
                                                        showBadge={true}
                                                    />
                                                </CardTitle>
                                                <CardDescription className="text-xs">
                                                    {isLinked ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                                                                <span className="text-green-600 dark:text-green-500 font-medium">
                                                                    Connected
                                                                </span>
                                                            </div>
                                                            {linkedAccount.providerAccountId && (
                                                                <>
                                                                    <span className="text-muted-foreground">•</span>
                                                                    <span className="text-muted-foreground font-mono truncate">
                                                                        {linkedAccount.providerAccountId}
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
                                            {isLinked ? (
                                                <UnlinkButton
                                                    provider={provider.provider}
                                                    providerName={providerInfo.displayName}
                                                />
                                            ) : (
                                                <LinkButton
                                                    provider={provider.provider}
                                                    providerName={providerInfo.displayName}
                                                    callbackUrl={`/${domain}/settings/permission-syncing`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
