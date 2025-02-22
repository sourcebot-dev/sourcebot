'use client';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button";
import { cn, isServiceError } from "@/lib/utils";
import { ChevronsUpDown, Check, PlusCircleIcon, Loader2, Eye, EyeOff } from "lucide-react";
import { useCallback, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { createSecret, getSecrets } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { Form, FormLabel, FormControl, FormDescription, FormItem, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/hooks/use-toast";

interface SecretComboBoxProps {
    isDisabled: boolean;
    secretKey?: string;
    onSecretChange: (secretKey: string) => void;
}

export const SecretCombobox = ({
    isDisabled,
    secretKey,
    onSecretChange,
}: SecretComboBoxProps) => {
    const [searchFilter, setSearchFilter] = useState("");
    const domain = useDomain();
    const [isCreateSecretDialogOpen, setIsCreateSecretDialogOpen] = useState(false);

    const { data: secrets, isLoading, refetch } = useQuery({
        queryKey: ["secrets"],
        queryFn: () => getSecrets(domain),
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
                            "w-[300px] justify-between overflow-hidden",
                            !secretKey && "text-muted-foreground"
                        )}
                        disabled={isDisabled}
                    >
                        <span className="truncate">{secretKey ? secretKey : "Select secret"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0.5">
                    {isLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    )}
                    {secrets && !isServiceError(secrets) && secrets.length > 0 && (
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
                        onClick={() => setIsCreateSecretDialogOpen(true)}
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
            />
        </>
    )
}

interface ImportSecretDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSecretCreated: (key: string) => void;
}

const formSchema = z.object({
    key: z.string().min(1),
    value: z.string().min(1),
});

const ImportSecretDialog = ({ open, onOpenChange, onSecretCreated }: ImportSecretDialogProps) => {
    const [showValue, setShowValue] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            key: "",
            value: "",
        },
    });
    const { isSubmitting } = form.formState;

    const onSubmit = useCallback(async (data: z.infer<typeof formSchema>) => {
        const response = await createSecret(data.key, data.value, domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create secret`
            });
        } else {
            toast({
                description: `✅ Secret created successfully!`
            });
            form.reset();
            onOpenChange(false);
            onSecretCreated(data.key);
        }
    }, [domain, toast, onOpenChange, onSecretCreated, form]);

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import a secret</DialogTitle>
                    {/* @todo: we will want to link to our security page here */}
                    <DialogDescription>Secrets are used to authenticate with a code host. They are encrypted at rest using <Link href="https://en.wikipedia.org/wiki/Advanced_Encryption_Standard" className="underline">AES-256-CBC</Link>.</DialogDescription>
                </DialogHeader>
                
                <Form
                    {...form}
                >
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.stopPropagation();
                            form.handleSubmit(onSubmit)(event);
                        }}
                    >
                        <FormField
                            control={form.control}
                            name="key"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Key</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="my-github-token"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        A unique name to identify this secret
                                    </FormDescription>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Value</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                {...field}
                                                type={showValue ? "text" : "password"}
                                                placeholder="Enter your secret value"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute right-2 top-1/2 -translate-y-1/2"
                                                onClick={() => setShowValue(!showValue)}
                                            >
                                                {showValue ? (
                                                    <EyeOff className="h-4 w-4" />
                                                ) : (
                                                    <Eye className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        The secret value to store securely
                                    </FormDescription>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end w-full">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Import Secret
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}