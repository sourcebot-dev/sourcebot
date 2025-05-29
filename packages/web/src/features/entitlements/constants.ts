
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const planLabels = {
    oss: "OSS",
    "cloud:team": "Team",
    "cloud:demo": "Demo",
    "self-hosted:enterprise": "Enterprise (Self-Hosted)",
    "self-hosted:enterprise-unlimited": "Enterprise (Self-Hosted) Unlimited",
} as const;
export type Plan = keyof typeof planLabels;


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const entitlements = [
    "search-contexts",
    "billing",
    "public-access",
    "multi-tenancy",
    "sso",
    "code-nav"
] as const;
export type Entitlement = (typeof entitlements)[number];

export const entitlementsByPlan: Record<Plan, Entitlement[]> = {
    oss: [],
    "cloud:team": ["billing", "multi-tenancy", "sso", "code-nav"],
    "self-hosted:enterprise": ["search-contexts", "sso", "code-nav"],
    "self-hosted:enterprise-unlimited": ["search-contexts", "public-access", "sso", "code-nav"],
    // Special entitlement for https://demo.sourcebot.dev
    "cloud:demo": ["public-access", "code-nav", "search-contexts"],
} as const;
