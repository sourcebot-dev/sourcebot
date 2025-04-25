'use client';

import { Entitlement, entitlementsByPlan } from "./constants";
import { usePlan } from "./usePlan";

export const useHasEntitlement = (entitlement: Entitlement) => {
    const plan = usePlan();
    const entitlements = entitlementsByPlan[plan];
    return entitlements.includes(entitlement);
}