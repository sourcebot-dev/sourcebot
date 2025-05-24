
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const planLabels = {
    oss: "OSS",
    "cloud:team": "Team",
    "self-hosted:enterprise": "Enterprise (Self-Hosted)",
    "self-hosted:enterprise-unlimited": "Enterprise (Self-Hosted) Unlimited",
    "self-hosted:enterprise-custom": "Enterprise (Self-Hosted) Custom",
} as const;
export type Plan = keyof typeof planLabels;


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const entitlements = [
    "search-contexts",
    "billing",
    "public-access",
    "multi-tenancy",
    "sso",
] as const;
export type Entitlement = (typeof entitlements)[number];

export const isValidEntitlement = (entitlement: string): entitlement is Entitlement => {
    return entitlements.includes(entitlement as Entitlement);
}

export const entitlementsByPlan: Record<Plan, Entitlement[]> = {
    oss: [],
    "cloud:team": ["billing", "multi-tenancy", "sso"],
    "self-hosted:enterprise": ["search-contexts", "sso"],
    "self-hosted:enterprise-unlimited": ["search-contexts", "public-access", "sso"],
    "self-hosted:enterprise-custom": [],
} as const;
