'use client';

import { checkIfSecretExists, createSecret } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { CodeHostType, isServiceError } from "@/lib/utils";
import githubPatCreation from "@/public/github_pat_creation.png";
import gitlabPatCreation from "@/public/gitlab_pat_creation.png";
import giteaPatCreation from "@/public/gitea_pat_creation.png";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";


interface ImportSecretDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSecretCreated: (key: string) => void;
    codeHostType: CodeHostType;
}


export const ImportSecretDialog = ({ open, onOpenChange, onSecretCreated, codeHostType }: ImportSecretDialogProps) => {
    const [showValue, setShowValue] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    const formSchema = z.object({
        key: z.string().min(1).refine(async (key) => {
            const doesSecretExist = await checkIfSecretExists(key, domain);
            if(!isServiceError(doesSecretExist)) {
                captureEvent('wa_secret_combobox_import_secret_fail', {
                    type: codeHostType,
                    error: "A secret with this key already exists.",
                });
            }
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
                description: `❌ Failed to create secret. Reason: ${response.message}`
            });
            captureEvent('wa_secret_combobox_import_secret_fail', {
                type: codeHostType,
                error: response.message,
            });
        } else {
            toast({
                description: `✅ Secret created successfully!`
            });
            captureEvent('wa_secret_combobox_import_secret_success', {
                type: codeHostType,
            });
            form.reset();
            onOpenChange(false);
            onSecretCreated(data.key);
        }
    }, [domain, toast, onOpenChange, onSecretCreated, form, codeHostType, captureEvent]);

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
                className="p-16 max-w-[90vw] sm:max-w-2xl max-h-[80vh] overflow-scroll rounded-lg"
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
            description=<span>Navigate <Link href="https://github.com/settings/tokens/new" target="_blank" className="underline">here on github.com</Link> (or your enterprise instance) and create a new personal access token. Sourcebot needs the <strong>repo</strong> scope in order to access private repositories:</span>
        >
            <Image
                className="mx-auto rounded-sm"
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
            description=<span>Navigate <Link href="https://gitlab.com/-/user_settings/personal_access_tokens" target="_blank" className="underline">here on gitlab.com</Link> (or your self-hosted instance) and create a new personal access token. Sourcebot needs the <strong>read_api</strong> scope in order to access private projects:</span>
        >
            <Image
                className="mx-auto rounded-sm"
                src={gitlabPatCreation}
                alt="Create a personal access token"
                width={600}
                height={600}
            />
        </SecretCreationStep>
    )
}

const GiteaPATCreationStep = ({ step }: { step: number }) => {
    return (
        <SecretCreationStep
            step={step}
            title="Create a Personal Access Token"
            description=<span>Navigate <Link href="https://gitea.com/user/settings/applications" target="_blank" className="underline">here on gitea.com</Link> (or your self-hosted instance) and create a new access token. Sourcebot needs the <strong>read:repository</strong>, <strong>read:user</strong>, and <strong>read:organization</strong> scopes:</span>
        >
            <Image
                className="mx-auto rounded-sm"
                src={giteaPatCreation}
                alt="Create a personal access token"
                width={600}
                height={600}
            />
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