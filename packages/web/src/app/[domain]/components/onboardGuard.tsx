'use client';

import { Redirect } from "@/app/components/redirect";
import { useDomain } from "@/hooks/useDomain";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface OnboardGuardProps {
    isOnboarded: boolean;
    children: React.ReactNode;
}

export const OnboardGuard = ({ isOnboarded, children }: OnboardGuardProps) => {
    const domain = useDomain();
    const pathname = usePathname();

    const content = useMemo(() => {
        if (!isOnboarded && !pathname.endsWith('/onboard')) {
            return (
                <Redirect
                    to={`/${domain}/onboard`}
                />
            )
        } else {
            return children;
        }
    }, [isOnboarded, domain, children, pathname]);

    return content;
}


