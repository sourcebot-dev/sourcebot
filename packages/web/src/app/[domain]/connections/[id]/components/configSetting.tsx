'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ConfigEditor, { isConfigValidJson, onQuickAction, QuickAction } from "../../../components/configEditor";
import { createZodConnectionConfigValidator } from "../../utils";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GerritConnectionConfig } from "@sourcebot/schemas/v3/gerrit.type";
import { githubQuickActions, gitlabQuickActions, giteaQuickActions, gerritQuickActions } from "../../quickActions";
import { Schema } from "ajv";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { updateConnectionConfigAndScheduleSync } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError, CodeHostType, isAuthSupportedForCodeHost } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { gerritSchema } from "@sourcebot/schemas/v3/gerrit.schema";
import { useDomain } from "@/hooks/useDomain";
import { SecretCombobox } from "@/app/[domain]/components/connectionCreationForms/secretCombobox";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";


interface ConfigSettingProps {
    connectionId: number;
    config: string;
    type: string;
}

export const ConfigSetting = (props: ConfigSettingProps) => {
    const { type } = props;

    if (type === 'github') {
        return <ConfigSettingInternal<GithubConnectionConfig>
            {...props}
            type="github"
            quickActions={githubQuickActions}
            schema={githubSchema}
        />;
    }

    if (type === 'gitlab') {
        return <ConfigSettingInternal<GitlabConnectionConfig>
            {...props}
            type="gitlab"
            quickActions={gitlabQuickActions}
            schema={gitlabSchema}
        />;
    }

    if (type === 'gitea') {
        return <ConfigSettingInternal<GiteaConnectionConfig>
            {...props}
            type="gitea"
            quickActions={giteaQuickActions}
            schema={giteaSchema}
        />;
    }

    if (type === 'gerrit') {
        return <ConfigSettingInternal<GerritConnectionConfig>
            {...props}
            type="gerrit"
            quickActions={gerritQuickActions}
            schema={gerritSchema}
        />;
    }

    return null;
}


function ConfigSettingInternal<T>({
    connectionId,
    config,
    quickActions,
    schema,
    type,
}: ConfigSettingProps & {
    quickActions?: QuickAction<T>[],
    schema: Schema,
    type: CodeHostType,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const domain = useDomain();
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [isSecretsDisabled, setIsSecretsDisabled] = useState(false);
    const [secretKey, setSecretKey] = useState<string | undefined>(undefined);

    const formSchema = useMemo(() => {
        return z.object({
            config: createZodConnectionConfigValidator(schema),
        });
    }, [schema]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            config,
        },
    });

    const [isLoading, setIsLoading] = useState(false);
    const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        updateConnectionConfigAndScheduleSync(connectionId, data.config, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to update connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection config updated successfully.`
                    });
                    router.push(`?tab=overview`);
                    router.refresh();
                }
            })
            .finally(() => {
                setIsLoading(false);
            })
    }, [connectionId, domain, router, toast]);

    const onConfigChange = useCallback((value: string) => {
        form.setValue("config", value);
        const isValid = isConfigValidJson(value);
        setIsSecretsDisabled(!isValid);
        if (isValid) {
            const configJson = JSON.parse(value);
            if (configJson.token?.secret !== undefined) {
                setSecretKey(configJson.token.secret);
            } else {
                setSecretKey(undefined);
            }
        }
    }, [form]);

    useEffect(() => {
        onConfigChange(config);
    }, [config, onConfigChange]);

    useEffect(() => {
        console.log("mount");
        return () => {
            console.log("unmount");
        }
    }, []);

    return (
        <div className="flex flex-col w-full bg-background border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Configuration</h3>
            <Form
                {...form}
            >
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex flex-col gap-6"
                >
                    {isAuthSupportedForCodeHost(type) && (
                        <div className="flex flex-col gap-2">
                            <FormLabel>Secret (optional)</FormLabel>
                            <FormDescription>If you want to use a secret, you can select one from the list below.</FormDescription>
                            <SecretCombobox
                                isDisabled={isSecretsDisabled}
                                secretKey={secretKey}
                                onSecretChange={(secretKey) => {
                                    const view = editorRef.current?.view;
                                    console.log(editorRef.current);
                                    if (!view) {
                                        return;
                                    }

                                    onQuickAction(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (previous: any) => {
                                            return {
                                                ...previous,
                                                token: {
                                                    secret: secretKey,
                                                }
                                            }
                                        },
                                        form.getValues("config"),
                                        view,
                                        {
                                            focusEditor: false
                                        }
                                    );
                                }}
                            />
                        </div>
                    )}
                    <FormField
                        control={form.control}
                        name="config"
                        render={({ field: { value } }) => (
                            <FormItem>
                                <FormItem>
                                    {isAuthSupportedForCodeHost(type) && (
                                        <FormLabel>Configuration</FormLabel>
                                    )}
                                    {/* @todo : refactor this description into a shared file */}
                                    <FormDescription>Code hosts are configured via a....TODO</FormDescription>
                                    <FormControl>
                                        <ConfigEditor<T>
                                            ref={editorRef}
                                            value={value}
                                            onChange={onConfigChange}
                                            schema={schema}
                                            actions={quickActions ?? []}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="mt-4 flex justify-end">
                        <Button
                            size="sm"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="animate-spin mr-2" />}
                            {isLoading ? 'Syncing...' : 'Save'}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}