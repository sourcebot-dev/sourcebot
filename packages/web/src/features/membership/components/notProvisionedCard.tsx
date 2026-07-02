import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";

/**
 * Shown to an authenticated user who is not a member of the org while SCIM
 * provisioning is enabled. Membership is owned by the IdP, so the usual
 * join / request-to-join flows don't apply — they must be provisioned upstream.
 */
export const NotProvisionedCard = () => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />

            <div className="w-full max-w-md">
                <div className="text-center space-y-8">
                    <SourcebotLogo
                        className="h-10 mx-auto"
                        size="large"
                    />

                    <div className="space-y-6">
                        <div className="w-12 h-12 mx-auto bg-accent rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-foreground">
                                Account not provisioned
                            </h1>
                            <p className="text-muted-foreground text-base">
                                Access to this organization is managed by your identity provider. Ask your administrator to provision your account.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
