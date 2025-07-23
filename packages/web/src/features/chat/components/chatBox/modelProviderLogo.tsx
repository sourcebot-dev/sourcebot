'use client';

import { useMemo } from "react";
import { LanguageModelProvider } from "../../types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import anthropicLogo from "@/public/anthropic.svg";
import bedrockLogo from "@/public/bedrock.svg";
import geminiLogo from "@/public/gemini.svg";
import openaiLogo from "@/public/openai.svg";

interface ModelProviderLogoProps {
    provider: LanguageModelProvider;
    className?: string;
}

export const ModelProviderLogo = ({
    provider,
    className,
}: ModelProviderLogoProps) => {
    const { src, className: logoClassName } = useMemo(() => {
        switch (provider) {
            case 'amazon-bedrock':
                return {
                    src: bedrockLogo,
                    className: 'w-3.5 h-3.5 dark:invert'
                };
            case 'anthropic':
                return {
                    src: anthropicLogo,
                    className: 'dark:invert'
                };
            case 'openai':
                return {
                    src: openaiLogo,
                    className: 'dark:invert w-3.5 h-3.5'
                };
            case 'google-generative-ai':
            case 'google-vertex':
                return {
                    src: geminiLogo,
                    className: 'w-3.5 h-3.5'
                };
            case 'google-vertex-anthropic':
                return {
                    src: anthropicLogo,
                    className: 'dark:invert'
                };
        }
    }, [provider]);

    return (
        <Image
            src={src}
            alt={provider}
            className={cn(
                'w-4 h-4',
                logoClassName,
                className
            )}
        />
    )
}
