import { AnonymousAccessEnabledSettingsCard } from "./components/anonymousAccessEnabledSettingsCard";
import { InviteLinkEnabledSettingsCard } from "./components/inviteLinkEnabledSettingsCard";
import { MemberApprovalRequiredSettingsCard } from "./components/memberApprovalRequiredSettingsCard";
import { CredentialsLoginEnabledSettingsCard } from "./components/credentialsLoginEnabledSettingsCard";
import { EmailCodeLoginEnabledSettingsCard } from "./components/emailCodeLoginEnabledSettingsCard";
import { IdentityProviderSettingsCard } from "./components/identityProviderSettingsCard";
import { IdentityProviderUpsellCard } from "./components/identityProviderUpsellCard";
import { ScimProvisioningSettings } from "./components/scimProvisioningSettings";
import { ScimEnabledSettingsCard } from "./components/scimEnabledSettingsCard";
import { ScimUpsellCard } from "./components/scimUpsellCard";
import { getScimTokens } from "@/ee/features/scim/actions";
import { UpgradeBadge } from "@/app/(app)/@sidebar/components/upgradeBadge";
import { getProviders, IdentityProvider } from "@/auth";
import { hasEntitlement, isAnonymousAccessEnabled } from "@/lib/entitlements";
import { createInviteLink, isServiceError } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { env, getSMTPConnectionURL, isCredentialsLoginEnabled, isEmailCodeLoginEnabled, isMemberApprovalRequired } from "@sourcebot/shared";
import { SettingsCardGroup } from "../components/settingsCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { isScimEnabled } from "@/features/scim/utils";

export default authenticatedPage(async ({ org }) => {
    const anonymousAccessEnabled = await isAnonymousAccessEnabled();
    const inviteLink = createInviteLink(env.AUTH_URL, org.inviteLinkId);
    const hasSSOEntitlement = await hasEntitlement("sso");
    const identityProviders = await getConfiguredIdentityProviders();

    const hasScimEntitlement = await hasEntitlement("scim");
    const scimBaseUrl = `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2`;
    const scimTokensResult = hasScimEntitlement ? await getScimTokens() : [];
    const scimTokens = isServiceError(scimTokensResult) ? [] : scimTokensResult;
    const scimEnabled = await isScimEnabled(org)


    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-lg font-medium">Security</h2>
            <div className="space-y-6">
                <div>
                    <p className="text-md font-medium">Organization access</p>
                    <p className="text-sm text-muted-foreground">Configure how users can access your Sourcebot deployment.{" "}
                        <a
                            href="https://docs.sourcebot.dev/docs/configuration/auth/access-settings"
                            target="_blank"
                            rel="noopener"
                            className="text-link hover:underline transition-colors"
                        >
                            Learn more
                        </a>
                    </p>
                </div>

                <SettingsCardGroup>
                    <InviteLinkEnabledSettingsCard
                        inviteLinkEnabled={org.inviteLinkEnabled}
                        inviteLink={inviteLink}
                        scimManaged={scimEnabled}
                    />
                    <MemberApprovalRequiredSettingsCard
                        memberApprovalRequired={isMemberApprovalRequired(org)}
                        scimManaged={scimEnabled}
                    />
                    <AnonymousAccessEnabledSettingsCard
                        anonymousAccessEnabled={anonymousAccessEnabled}
                    />
                </SettingsCardGroup>

                <p className="text-md font-medium">Email login</p>

                <SettingsCardGroup>
                    <CredentialsLoginEnabledSettingsCard
                        isCredentialsLoginEnabled={isCredentialsLoginEnabled(org)}
                    />
                    <EmailCodeLoginEnabledSettingsCard
                        isEmailCodeLoginEnabled={isEmailCodeLoginEnabled(org)}
                        isEmailServiceConfigured={!!getSMTPConnectionURL() && !!env.EMAIL_FROM_ADDRESS}
                    />
                </SettingsCardGroup>

                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-md font-medium">Single Sign-On</p>
                        {!hasSSOEntitlement && <UpgradeBadge />}
                    </div>
                    <p className="text-sm text-muted-foreground">Let users sign in with an external identity provider such as GitHub, Google, or Okta. Providers are managed in your config file.{" "}
                        <a
                            href="https://docs.sourcebot.dev/docs/configuration/idp"
                            target="_blank"
                            rel="noopener"
                            className="text-link hover:underline transition-colors"
                        >
                            Learn more
                        </a>
                    </p>
                </div>

                {!hasSSOEntitlement ? (
                    <IdentityProviderUpsellCard />
                ) : identityProviders.length > 0 ? (
                    <SettingsCardGroup>
                        {identityProviders.map((provider) => (
                            <IdentityProviderSettingsCard key={provider.id} provider={provider} />
                        ))}
                    </SettingsCardGroup>
                ) : (
                    <Alert className="items-center p-4">
                        <Info className="w-4 h-4 text-muted-foreground" />
                        <AlertDescription>
                            No identity providers are configured. Add them in your config file.{" "}
                            <a
                                href="https://docs.sourcebot.dev/docs/configuration/idp"
                                target="_blank"
                                rel="noopener"
                                className="!text-link !no-underline hover:!underline"
                            >
                                Learn more
                            </a>
                        </AlertDescription>
                    </Alert>
                )}

                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-md font-medium">SCIM Provisioning</p>
                        {!hasScimEntitlement && <UpgradeBadge />}
                    </div>
                    <p className="text-sm text-muted-foreground">Provision and deprovision members automatically from your identity provider (Okta, Entra). Configure your IdP with the base URL below and a SCIM token.{" "}
                        <a
                            href="https://docs.sourcebot.dev/docs/configuration/auth/scim"
                            target="_blank"
                            rel="noopener"
                            className="text-link hover:underline transition-colors"
                        >
                            Learn more
                        </a>
                    </p>
                </div>

                {!hasScimEntitlement ? (
                    <ScimUpsellCard />
                ) : (
                    <>
                        <SettingsCardGroup>
                            <ScimEnabledSettingsCard isScimEnabled={scimEnabled} />
                        </SettingsCardGroup>
                        {scimEnabled && (
                            <ScimProvisioningSettings baseUrl={scimBaseUrl} tokens={scimTokens} />
                        )}
                    </>
                )}
            </div>
        </div>
    )
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});

const getConfiguredIdentityProviders = async (): Promise<IdentityProvider[]> => {
    const providers = await getProviders();
    return providers.filter((provider) =>
        provider.purpose === "sso" && !["credentials", "nodemailer"].includes(provider.type)
    );
}