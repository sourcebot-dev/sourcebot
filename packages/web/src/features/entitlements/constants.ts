
const planLabels = {
    oss: "OSS",
    "cloud:team": "Team",
    "cloud:enterprise": "Enterprise",
    "self-hosted:enterprise": "Enterprise (Self-Hosted)",
} as const;
export type Plan = keyof typeof planLabels;


const entitlements = [
    "search-contexts"
] as const;
export type Entitlement = (typeof entitlements)[number];

export const entitlementsByPlan: Record<Plan, Entitlement[]> = {
    oss: [],
    "cloud:team": [],
    "cloud:enterprise": ["search-contexts"],
    "self-hosted:enterprise": ["search-contexts"],
} as const;
