
// @note: Order is important here.
export enum OnboardingSteps {
    CreateOrg = 'create-org',
    ConnectCodeHost = 'connect-code-host',
    InviteTeam = 'invite-team',
    Checkout = 'checkout',
    Complete = 'complete',
}

export const ENTERPRISE_FEATURES = [
    "All Team features",
    "Dedicated Slack support channel",
    "Single tenant deployment",
    "Advanced security features",
]

export const TEAM_FEATURES = [
    "Blazingly fast code search",
    "Index hundreds of repos from multiple code hosts (GitHub, GitLab, Gerrit, Gitea, etc.). Self-hosted code hosts supported.",
    "Public and private repos supported.",
    "Create shareable links to code snippets.",
    "Powerful regex and symbol search",
]

export const MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME = 'sb.mobile-unsupported-splash-screen-dismissed';