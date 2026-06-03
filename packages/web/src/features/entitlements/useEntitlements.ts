'use client';

import { useContext } from "react";
import { PlanContext } from "./planProvider";

export const useEntitlements = () => {
    const { entitlements } = useContext(PlanContext);
    return entitlements;
}