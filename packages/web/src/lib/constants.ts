
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
    "Index thousands of repos from multiple code hosts (GitHub, GitLab, Gerrit, Gitea, etc.). Self-hosted code hosts supported.",
    "Public and private repos supported.",
    "Create shareable links to code snippets.",
    "Built on-top of zoekt, Google's code search engine. Blazingly fast and powerful (regex, symbol) code search.",
]

export const MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME = 'sb.mobile-unsupported-splash-screen-dismissed';

export const SINGLE_TENANT_USER_ID = '1';
export const SINGLE_TENANT_USER_EMAIL = 'default@sourcebot.dev';
export const SINGLE_TENANT_ORG_ID = 1;
export const SINGLE_TENANT_ORG_DOMAIN = '~';
export const SINGLE_TENANT_ORG_NAME = 'default';

export const SOURCEBOT_SUPPORT_EMAIL = 'team@sourcebot.dev';