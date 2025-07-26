'use client';

import { useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { LoadingButton } from "@/components/ui/loading-button";

interface ProviderButtonProps {
    name: string;
    logo: { src: string, className?: string } | null;
    onClick: () => void | Promise<void>;
    className?: string;
    context: "login" | "signup";
}

export const ProviderButton = ({
    name,
    logo,
    onClick,
    className,
    context,
}: ProviderButtonProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        try {
            await onClick();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LoadingButton
            onClick={handleClick}
            className={cn("w-full", className)}
            variant="outline"
            loading={isLoading}
        >
            {logo && <Image src={logo.src} alt={name} className={cn("w-5 h-5 mr-2", logo.className)} />}
            {context === "login" ? `Sign in with ${name}` : `Sign up with ${name}`}
        </LoadingButton>
    );
}; 