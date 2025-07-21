'use client';

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { LanguageModelInfo } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import {
    Bot,
    CheckIcon,
    ChevronDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ModelProviderLogo } from "./modelProviderLogo";

interface LanguageModelSelectorProps {
    languageModels: LanguageModelInfo[];
    selectedModel?: LanguageModelInfo;
    onSelectedModelChange: (model: LanguageModelInfo) => void;
    className?: string;
}

export const LanguageModelSelector = ({
    languageModels: _languageModels,
    selectedModel,
    onSelectedModelChange,
    className,
}: LanguageModelSelectorProps) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const handleInputKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Enter") {
            setIsPopoverOpen(true);
        }
    };

    const selectModel = (model: LanguageModelInfo) => {
        onSelectedModelChange(model);
        setIsPopoverOpen(false);
    };

    const handleTogglePopover = () => {
        setIsPopoverOpen((prev) => !prev);
    };

    // De-duplicate models
    const languageModels = useMemo(() => {
        return _languageModels.filter((model, selfIndex, selfArray) =>
            selfIndex === selfArray.findIndex((t) => t.model === model.model)
        );
    }, [_languageModels]);

    return (
        <Popover
            open={isPopoverOpen}
            onOpenChange={setIsPopoverOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    onClick={handleTogglePopover}
                    className={cn(
                        "flex p-1 rounded-md items-center justify-between bg-inherit h-6",
                        className
                    )}
                >
                    <div className="flex items-center justify-between mx-auto max-w-64 overflow-hidden">
                        {selectedModel ? (
                            <ModelProviderLogo 
                                provider={selectedModel.provider} 
                                className="mr-1" 
                            />
                        ) : (
                            <Bot className="h-4 w-4 text-muted-foreground mr-1" />
                        )}
                        <span
                            className={cn(
                                "text-sm text-muted-foreground mx-1 text-ellipsis overflow-hidden whitespace-nowrap",
                                selectedModel ? "font-medium" : "font-normal"
                            )}
                        >
                            {selectedModel ? (selectedModel.displayName ?? selectedModel.model) : "Select model"}
                        </span>
                        <ChevronDown className="h-4 cursor-pointer text-muted-foreground ml-2" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0"
                align="start"
                onEscapeKeyDown={() => setIsPopoverOpen(false)}
            >
                <Command>
                    <CommandInput
                        placeholder="Search models..."
                        onKeyDown={handleInputKeyDown}
                    />
                    <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        <CommandGroup>
                            {languageModels
                                .map((model, index) => {
                                const isSelected = selectedModel?.model === model.model;
                                return (
                                    <CommandItem
                                        key={`${model.model}-${index}`}
                                        onSelect={() => {
                                            selectModel(model)
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <CheckIcon className="h-4 w-4" />
                                        </div>
                                        <ModelProviderLogo 
                                            provider={model.provider} 
                                            className="mr-2" 
                                        />
                                        <span>{model.displayName ?? model.model}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
