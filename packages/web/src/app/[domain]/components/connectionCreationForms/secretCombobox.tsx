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
import { ChevronsUpDown, Check, PlusCircleIcon, Loader2, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { checkIfSecretExists, createSecret, getSecrets } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { Dialog, DialogTitle, DialogContent, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { Form, FormLabel, FormControl, FormDescription, FormItem, FormField, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/hooks/use-toast";
import Image from "next/image";
import githubPatCreation from "@/public/github_pat_creation.png"
import { CodeHostType } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isDefined } from '@/lib/utils'

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

    const { data: secrets, isLoading, refetch } = useQuery({
        queryKey: ["secrets"],
        queryFn: () => getSecrets(domain),
    });

    const onSecretCreated = useCallback((key: string) => {
        onSecretChange(key);
        refetch();
    }, [onSecretChange, refetch]);

    const isSecretNotFoundWarningVisible = useMemo(() => {
        if (!isDefined(secretKey)) {
            return false;
        }
        if (isServiceError(secrets)) {
            return false;
        }
        return !secrets?.some(({ key }) => key === secretKey);
    }, [secretKey, secrets]);

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
                        {isSecretNotFoundWarningVisible && (
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
                codeHostType={codeHostType}
            />
        </>
    )
}

interface ImportSecretDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSecretCreated: (key: string) => void;
    codeHostType: CodeHostType;
}


const ImportSecretDialog = ({ open, onOpenChange, onSecretCreated, codeHostType }: ImportSecretDialogProps) => {
    const [showValue, setShowValue] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();

    const formSchema = z.object({
        key: z.string().min(1).refine(async (key) => {
            const doesSecretExist = await checkIfSecretExists(key, domain);
            return isServiceError(doesSecretExist) || !doesSecretExist;
        }, "A secret with this key already exists."),
        value: z.string().min(1),
    });

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

    const codeHostSpecificStep = useMemo(() => {
        switch (codeHostType) {
            case 'github':
                return <GitHubPATCreationStep step={1} />;
            case 'gitlab':
                return <GitLabPATCreationStep step={1} />;
            case 'gitea':
                return <GiteaPATCreationStep step={1} />;
            case 'gerrit':
                return null;
        }
    }, [codeHostType]);


    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent
                className="p-16 max-w-2xl max-h-[80vh] overflow-scroll"
            >
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold">Import a secret</DialogTitle>
                    <DialogDescription>
                        Secrets are used to authenticate with a code host. They are encrypted at rest using <Link href="https://en.wikipedia.org/wiki/Advanced_Encryption_Standard" target="_blank" className="underline">AES-256-CBC</Link>.
                        Checkout our <Link href="https://sourcebot.dev/security" target="_blank" className="underline">security docs</Link> for more information.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...form}
                >
                    <form
                        className="space-y-4 flex flex-col mt-4 gap-4"
                        onSubmit={(event) => {
                            event.stopPropagation();
                            form.handleSubmit(onSubmit)(event);
                        }}
                    >
                        {codeHostSpecificStep}

                        <SecretCreationStep
                            step={2}
                            title="Import the secret"
                            description="Copy the generated token and paste it below."
                        >
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
                                            The secret value to store securely.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </SecretCreationStep>

                        <SecretCreationStep
                            step={3}
                            title="Name the secret"
                            description="Give the secret a unique name so that it can be referenced in a connection config."
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
                                            A unique name to identify this secret.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </SecretCreationStep>

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

const GitHubPATCreationStep = ({ step }: { step: number }) => {
    return (
        <SecretCreationStep
            step={step}
            title="Create a Personal Access Token"
            description=<span>Navigate to <Link href="https://github.com/settings/tokens/new" target="_blank" className="underline">here on github.com</Link> (or your enterprise instance) and create a new personal access token. Sourcebot needs the <strong>repo</strong> scope in order to access private repositories:</span>
        >
            <Image
                className="mx-auto"
                src={githubPatCreation}
                alt="Create a personal access token"
                width={500}
                height={500}
            />
        </SecretCreationStep>
    )
}

const GitLabPATCreationStep = ({ step }: { step: number }) => {
    return (
        <SecretCreationStep
            step={step}
            title="Create a Personal Access Token"
            description="todo"
        >
            <p>todo</p>
        </SecretCreationStep>
    )
}

const GiteaPATCreationStep = ({ step }: { step: number }) => {
    return (
        <SecretCreationStep
            step={step}
            title="Create a Personal Access Token"
            description="todo"
        >
            <p>todo</p>
        </SecretCreationStep>
    )
}

interface SecretCreationStepProps {
    step: number;
    title: string;
    description: string | React.ReactNode;
    children: React.ReactNode;
}

const SecretCreationStep = ({ step, title, description, children }: SecretCreationStepProps) => {
    return (
        <div className="relative flex flex-col gap-2">
            <div className="absolute -left-10 flex flex-col items-center gap-2 h-full">
                <span className="text-md font-semibold border rounded-full px-2">{step}</span>
                <Separator className="h-5/6" orientation="vertical" />
            </div>
            <h3 className="text-md font-semibold">
                {title}
            </h3>
            <p className="text-sm text-muted-foreground">
                {description}
            </p>
            {children}
        </div>
    )
}