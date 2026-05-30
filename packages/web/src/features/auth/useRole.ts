'use client';

import { useContext } from "react";
import { RoleContext } from "./roleProvider";

export const useRole = () => {
    const { role } = useContext(RoleContext);
    return role;
}
