import { AnonymousAccessEnabledSettingsCard } from "./components/anonymousAccessEnabledSettingsCard";
import { InviteLinkEnabledSettingsCard } from "./components/inviteLinkEnabledSettingsCard";
import { MemberApprovalRequiredSettingsCard } from "./components/memberApprovalRequiredSettingsCard";
import { CredentialsLoginEnabledSettingsCard } from "./components/credentialsLoginEnabledSettingsCard";
import { getProviders } from "@/auth";
import { isAnonymousAccessAvailable, isAnonymousAccessEnabled } from "@/lib/entitlements";
import { createInviteLink } from "@/lib/utils";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { env, isCredentialsLoginEnabled, isMemberApprovalRequired } from "@sourcebot/shared";
import { SettingsCardGroup } from "../components/settingsCard";

export default authenticatedPage(async ({ org }) => {
    const anonymousAccessEnabled = await isAnonymousAccessEnabled();
    const anonymousAccessAvailable = await isAnonymousAccessAvailable();
    const inviteLink = createInviteLink(env.AUTH_URL, org.inviteLinkId);
    const providers = await getProviders();

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
                            className="underline text-primary hover:text-primary/80 transition-colors"
                        >
                            Learn more
                        </a>
                    </p>
                </div>

                <SettingsCardGroup>
                    <InviteLinkEnabledSettingsCard
                        inviteLinkEnabled={org.inviteLinkEnabled}
                        inviteLink={inviteLink}
                    />
                    <MemberApprovalRequiredSettingsCard
                        memberApprovalRequired={isMemberApprovalRequired(org)}
                        isControlledByEnvVar={env.REQUIRE_APPROVAL_NEW_MEMBERS !== undefined}
                    />
                    <AnonymousAccessEnabledSettingsCard
                        anonymousAccessAvailable={anonymousAccessAvailable}
                        anonymousAccessEnabled={anonymousAccessEnabled}
                        isControlledByEnvVar={env.FORCE_ENABLE_ANONYMOUS_ACCESS !== undefined}
                    />
                </SettingsCardGroup>

                <p className="text-md font-medium">Authentication methods</p>

                <SettingsCardGroup>
                    <CredentialsLoginEnabledSettingsCard
                        isCredentialsLoginEnabled={isCredentialsLoginEnabled(org)}
                        isControlledByEnvVar={env.AUTH_CREDENTIALS_LOGIN_ENABLED !== undefined}
                        hasAlternativeLoginMethod={providers.some((provider) => provider.type !== "credentials")}
                    />
                </SettingsCardGroup>
            </div>
        </div>
    )
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});
