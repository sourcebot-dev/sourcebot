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
import { Box, LucideIcon } from "lucide-react";

interface ModelProviderLogoProps {
    provider: LanguageModelProvider;
    className?: string;
}

export const ModelProviderLogo = ({
    provider,
    className,
}: ModelProviderLogoProps) => {
    const { src, Icon, className: logoClassName } = useMemo((): { src?: string, Icon?: LucideIcon, className?: string } => {
        switch (provider) {
            case 'amazon-bedrock':
                return {
                    src: bedrockLogo,
                    className: 'dark:invert'
                };
            case 'anthropic':
                return {
                    src: anthropicLogo,
                    className: 'dark:invert'
                };
            case 'azure':
                return {
                    src: azureAiLogo,
                };
            case 'deepseek':
                return {
                    src: deepseekLogo,
                };
            case 'openai':
                return {
                    src: openaiLogo,
                    className: 'dark:invert'
                };
            case 'google-generative-ai':
            case 'google-vertex':
                return {
                    src: geminiLogo,
                };
            case 'google-vertex-anthropic':
                return {
                    src: anthropicLogo,
                    className: 'dark:invert'
                };
            case 'mistral':
                return {
                    src: mistralLogo,
                };
            case 'openrouter':
                return {
                    src: openrouterLogo,
                    className: 'dark:invert'
                };
            case 'xai':
                return {
                    src: xaiLogo,
                    className: 'dark:invert'
                };
            case 'openai-compatible':
                return {
                    Icon: Box,
                    className: 'text-muted-foreground'
                };
        }
    }, [provider]);

    return src ? (
        <Image
            src={src}
            alt={provider}
            className={cn(
                'w-3.5 h-3.5',
                logoClassName,
                className
            )}
        />
    ) : Icon ? (
        <Icon className={cn(
            'w-3.5 h-3.5',
            logoClassName,
            className
        )} />
    ) : null;
}
