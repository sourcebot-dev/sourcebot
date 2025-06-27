// Adapted from: web/src/components/ui/multi-select.tsx

import * as React from "react";
import {
    CheckIcon,
    ChevronDown,
    BookMarkedIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";


/**
 * Props for MultiSelect component
 */
interface RepoSelectorProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * An array of option objects to be displayed in the multi-select component.
     * Each option object has a label, value, and an optional icon.
     */
    values: string[];

    selectedValues: string[];

    /**
     * Callback function triggered when the selected values change.
     * Receives an array of the new selected values.
     */
    onValueChange: (value: string[]) => void;

    /**
     * Additional class names to apply custom styles to the multi-select component.
     * Optional, can be used to add custom styles.
     */
    className?: string;
}

export const RepoSelector = React.forwardRef<
    HTMLButtonElement,
    RepoSelectorProps
>(
    (
        {
            values,
            onValueChange,
            className,
            selectedValues,
            ...props
        },
        ref
    ) => {
        const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

        const handleInputKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>
        ) => {
            if (event.key === "Enter") {
                setIsPopoverOpen(true);
            } else if (event.key === "Backspace" && !event.currentTarget.value) {
                const newSelectedValues = [...selectedValues];
                newSelectedValues.pop();
                onValueChange(newSelectedValues);
            }
        };

        const toggleOption = (option: string) => {
            const newSelectedValues = selectedValues.includes(option)
                ? selectedValues.filter((value) => value !== option)
                : [...selectedValues, option];
            onValueChange(newSelectedValues);
        };

        const handleClear = () => { 
            onValueChange([]);
        };

        const handleTogglePopover = () => {
            setIsPopoverOpen((prev) => !prev);
        };

        return (
            <Popover
                open={isPopoverOpen}
                onOpenChange={setIsPopoverOpen}
            >
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        {...props}
                        onClick={handleTogglePopover}
                        className={cn(
                            "flex p-1 rounded-md items-center justify-between bg-inherit h-6",
                            className
                        )}
                    >
                        <div className="flex items-center justify-between w-full mx-auto">
                            <BookMarkedIcon className="h-4 w-4 text-muted-foreground mr-1" />
                            <span
                                className={cn(
                                    "text-sm text-muted-foreground mx-1",
                                    selectedValues.length > 0 ? "font-medium" : "font-normal"
                                )}
                            >
                                {
                                    selectedValues.length === 0 ? `${values.length} repo${values.length === 1 ? '' : 's'}` :
                                        selectedValues.length === 1 ? `${selectedValues[0].split('/').pop()}` :
                                            `${selectedValues.length} repo${selectedValues.length === 1 ? '' : 's'}`
                                }
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
                            placeholder="Search repos..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>

                                {values.map((value) => {
                                    const isSelected = selectedValues.includes(value);
                                    return (
                                        <CommandItem
                                            key={value}
                                            onSelect={() => toggleOption(value)}
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
                                            <span>{value}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            {selectedValues.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <CommandItem
                                        onSelect={handleClear}
                                        className="flex-1 justify-center cursor-pointer"
                                    >
                                        Clear
                                    </CommandItem>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

RepoSelector.displayName = "RepoSelector";