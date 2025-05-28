'use client';

import { getSecrets } from "@/actions";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { cn, CodeHostType, isDefined, isServiceError, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, PlusCircleIcon, TriangleAlert } from "lucide-react";
import { useCallback, useState } from "react";
import { ImportSecretDialog } from "../importSecretDialog";

interface SecretComboBoxProps {
    isDisabled: boolean;
    codeHostType: CodeHostType;
    secretKey?: string;
    onSecretChange: (secretKey: string) => void;
}

export const SecretCombobox = ({
    isDisabled,
    codeHostType,
    secretKey,
    onSecretChange,
}: SecretComboBoxProps) => {
    const [searchFilter, setSearchFilter] = useState("");
    const domain = useDomain();
    const [isCreateSecretDialogOpen, setIsCreateSecretDialogOpen] = useState(false);
    const captureEvent = useCaptureEvent();

    const { data: secrets, isPending, isError, refetch } = useQuery({
        queryKey: ["secrets", domain],
        queryFn: () => unwrapServiceError(getSecrets(domain)),
    });

    const onSecretCreated = useCallback((key: string) => {
        onSecretChange(key);
        refetch();
    }, [onSecretChange, refetch]);

    return (
        <>
            <Popover>
                <PopoverTrigger asChild>

                    <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                            "w-[300px] overflow-hidden",
                            !secretKey && "text-muted-foreground"
                        )}
                        disabled={isDisabled}
                    >
                        {!(isPending || isError) && isDefined(secretKey) && !secrets.some(({ key }) => key === secretKey) && (
                            <TooltipProvider>

                                <Tooltip
                                    delayDuration={100}
                                >
                                    <TooltipTrigger
                                        onClick={(e) => e.preventDefault()}
                                    >
                                        <TriangleAlert className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>The secret you selected does not exist.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <span className="truncate">{isDefined(secretKey) ? secretKey : "Select secret"}</span>
                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0.5">
                    {isPending ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    ) : isError ? (
                        <p className="p-2 text-sm text-destructive">Failed to load secrets</p>
                    ) : secrets.length > 0 && (
                        <>
                            <Command className="mb-2">
                                <CommandInput
                                    placeholder="Search secrets..."
                                    value={searchFilter}
                                    onValueChange={(value) => setSearchFilter(value)}
                                />
                                <CommandList>
                                    <CommandEmpty>
                                        <p className="text-sm">No secrets found</p>
                                        <p className="text-sm text-muted-foreground">{`Your search term "${searchFilter}" did not match any secrets.`}</p>
                                    </CommandEmpty>
                                    <CommandGroup
                                        heading="Secrets"
                                    >
                                        {secrets.map(({ key }) => (
                                            <CommandItem
                                                className="cursor-pointer"
                                                value={key}
                                                key={key}
                                                onSelect={() => {
                                                    onSecretChange(key);
                                                }}
                                            >
                                                {key}
                                                <Check
                                                    className={cn(
                                                        "ml-auto",
                                                        key === secretKey
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                    )}
                                                />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                            <Separator className="mt-2" />
                        </>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setIsCreateSecretDialogOpen(true);
                            captureEvent('wa_secret_combobox_import_secret_pressed', {
                                type: codeHostType,
                            });
                        }}
                        className={cn(
                            "w-full justify-start gap-1.5 p-2",
                            secrets && !isServiceError(secrets) && secrets.length > 0 && "my-2"
                        )}
                    >
                        <PlusCircleIcon className="h-5 w-5 text-muted-foreground mr-1" />
                        Import a secret
                    </Button>
                </PopoverContent>
            </Popover>
            <ImportSecretDialog
                open={isCreateSecretDialogOpen}
                onOpenChange={setIsCreateSecretDialogOpen}
                onSecretCreated={onSecretCreated}
                codeHostType={codeHostType}
            />
        </>
    )
}
