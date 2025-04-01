'use client';

import { cn, CodeHostType, getCodeHostIcon } from "@/lib/utils";
import { useMemo } from "react";
import Image from "next/image";
import placeholderLogo from "@/public/placeholder_avatar.png";

interface ConnectionIconProps {
    type: string;
    className?: string;
}

export const ConnectionIcon = ({
    type,
    className,
}: ConnectionIconProps) => {
    const Icon = useMemo(() => {
        const iconInfo = getCodeHostIcon(type as CodeHostType);
        if (iconInfo) {
            return (
                <Image
                    src={iconInfo.src}
                    className={cn(cn("rounded-full w-8 h-8", iconInfo.className), className)}
                    alt={`${type} logo`}
                />
            )
        }

        return <Image
            src={placeholderLogo}
            alt={''}
            className={cn("rounded-full w-8 h-8", className)}
        />

    }, [className, type]);

    return Icon;
}