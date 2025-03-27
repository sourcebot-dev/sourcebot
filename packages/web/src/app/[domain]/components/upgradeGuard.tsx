'use client';

import { Redirect } from "@/app/components/redirect";
import { useDomain } from "@/hooks/useDomain";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface UpgradeGuardProps {
    children: React.ReactNode;
}

export const UpgradeGuard = ({ children }: UpgradeGuardProps) => {
    const domain = useDomain();
    const pathname = usePathname();

    const content = useMemo(() => {
        if (!pathname.endsWith('/upgrade')) {
            return (
                <Redirect
                    to={`/${domain}/upgrade`}
                />
            )
        } else {
            return children;
        }
    }, [domain, children, pathname]);

    return content;
}


