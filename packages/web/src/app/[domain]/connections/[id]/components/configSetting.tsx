'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfigEditor, QuickAction } from "../../components/configEditor";
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
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { gerritSchema } from "@sourcebot/schemas/v3/gerrit.schema";
import { useDomain } from "@/hooks/useDomain";


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
            quickActions={githubQuickActions}
            schema={githubSchema}
        />;
    }

    if (type === 'gitlab') {
        return <ConfigSettingInternal<GitlabConnectionConfig>
            {...props}
            quickActions={gitlabQuickActions}
            schema={gitlabSchema}
        />;
    }

    if (type === 'gitea') {
        return <ConfigSettingInternal<GiteaConnectionConfig>
            {...props}
            quickActions={giteaQuickActions}
            schema={giteaSchema}
        />;
    }

    if (type === 'gerrit') {
        return <ConfigSettingInternal<GerritConnectionConfig>
            {...props}
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
}: ConfigSettingProps & {
    quickActions?: QuickAction<T>[],
    schema: Schema,
}) {
    const { toast } = useToast();
    const router = useRouter();
    const domain = useDomain();
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

    return (
        <div className="flex flex-col w-full bg-background border rounded-lg p-6">
            <Form
                {...form}
            >
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        control={form.control}
                        name="config"
                        render={({ field: { value, onChange } }) => (
                            <FormItem>
                                <FormItem>
                                    <FormLabel className="text-lg font-semibold">Configuration</FormLabel>
                                    {/* @todo : refactor this description into a shared file */}
                                    <FormDescription>Code hosts are configured via a....TODO</FormDescription>
                                    <FormControl>
                                        <ConfigEditor<T>
                                            value={value}
                                            onChange={onChange}
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