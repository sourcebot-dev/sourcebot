'use client';

import { Entitlement } from "./constants";
import { useContext } from "react";
import { PlanContext } from "./planProvider";

export const useHasEntitlement = (entitlement: Entitlement) => {
    const { entitlements } = useContext(PlanContext);
    return entitlements.includes(entitlement);
}