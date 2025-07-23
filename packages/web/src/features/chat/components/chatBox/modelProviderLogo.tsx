'use client';

import { useMemo } from "react";
import { LanguageModelProvider } from "../../types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import anthropicLogo from "@/public/anthropic.svg";
import azureAiLogo from "@/public/azureai.svg";
import bedrockLogo from "@/public/bedrock.svg";
import geminiLogo from "@/public/gemini.svg";
import openaiLogo from "@/public/openai.svg";
import deepseekLogo from "@/public/deepseek.svg";
import mistralLogo from "@/public/mistral.svg";
import openrouterLogo from "@/public/openrouter.svg";
import xaiLogo from "@/public/xai.svg";

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
            case 'azure':
                return {
                    src: azureAiLogo,
                    className: 'w-3.5 h-3.5'
                };
            case 'deepseek':
                return {
                    src: deepseekLogo,
                    className: 'w-3.5 h-3.5'
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
            case 'mistral':
                return {
                    src: mistralLogo,
                    className: 'w-3.5 h-3.5'
                };
            case 'openrouter':
                return {
                    src: openrouterLogo,
                    className: 'dark:invert w-3.5 h-3.5'
                };
            case 'xai':
                return {
                    src: xaiLogo,
                    className: 'dark:invert w-3.5 h-3.5'
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
