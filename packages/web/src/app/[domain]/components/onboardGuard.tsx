'use client';

import { Redirect } from "@/app/components/redirect";
import { useDomain } from "@/hooks/useDomain";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface OnboardGuardProps {
    children: React.ReactNode;
}

export const OnboardGuard = ({ children }: OnboardGuardProps) => {
    const domain = useDomain();
    const pathname = usePathname();

    const content = useMemo(() => {
        if (!pathname.endsWith('/onboard')) {
            return (
                <Redirect
                    to={`/${domain}/onboard`}
                />
            )
        } else {
            return children;
        }
    }, [domain, children, pathname]);

    return content;
}


