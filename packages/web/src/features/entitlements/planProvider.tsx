'use client';

import { createContext } from "react";
import { Plan } from "./constants";

export const PlanContext = createContext<Plan>('oss');

interface PlanProviderProps {
    children: React.ReactNode;
    plan: Plan;
}

export const PlanProvider = ({ children, plan }: PlanProviderProps) => {
    return (
        <PlanContext.Provider
            value={plan}
        >
            {children}
        </PlanContext.Provider>
    )
};
