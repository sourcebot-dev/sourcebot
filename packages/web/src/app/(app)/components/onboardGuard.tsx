'use client';

import { Redirect } from "@/app/components/redirect";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface OnboardGuardProps {
    children: React.ReactNode;
}

export const OnboardGuard = ({ children }: OnboardGuardProps) => {
    const pathname = usePathname();

    const content = useMemo(() => {
        if (!pathname.endsWith('/onboard')) {
            return (
                <Redirect
                    to={`/onboard`}
                />
            )
        } else {
            return children;
        }
    }, [children, pathname]);

    return content;
}


