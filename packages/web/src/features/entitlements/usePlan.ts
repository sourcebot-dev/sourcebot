import { useContext } from "react";
import { PlanContext } from "./planProvider";

export const usePlan = () => {
    const plan = useContext(PlanContext);
    return plan;
}