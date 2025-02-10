
'use client';

import { createConnection } from "@/actions";
import { ConnectionIcon } from "@/app/connections/components/connectionIcon";
import { createZodConnectionConfigValidator } from "@/app/connections/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Schema } from "ajv";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfigEditor, QuickActionFn } from "../../../components/configEditor";

interface ConnectionCreationForm<T> {
    type: 'github' | 'gitlab' | 'gitea' | 'gerrit';
    defaultValues: {
        name: string;
        config: string;
    };
    title: string;
    schema: Schema;
    quickActions?: {
        name: string;
        fn: QuickActionFn<T>;
    }[],
}

export default function ConnectionCreationForm<T>({
    type,
    defaultValues,
    title,
    schema,
    quickActions,
}: ConnectionCreationForm<T>) {

    const { toast } = useToast();
    const router = useRouter();

    const formSchema = useMemo(() => {
        return z.object({
            name: z.string().min(1),
            config: createZodConnectionConfigValidator(schema),
        });
    }, [schema]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultValues,
    });

    const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
        createConnection(data.name, type, data.config)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to create connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection created successfully.`
                    });
                    router.push('/connections');
                    router.refresh();
                }
            });
    }, [router, toast, type]);

    return (
        <div className="flex flex-col max-w-3xl mx-auto bg-background border rounded-lg p-6">
            <div className="flex flex-row items-center gap-3 mb-6">
                <ConnectionIcon
                    type={type}
                    className="w-7 h-7"
                />
                <h1 className="text-3xl">{title}</h1>
            </div>
            <Form
                {...form}
            >
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="flex flex-col gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Display Name</FormLabel>
                                    <FormDescription>This is the {`connection's`} display name within Sourcebot. Examples: <b>public-github</b>, <b>self-hosted-gitlab</b>, <b>gerrit-other</b>, etc.</FormDescription>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            spellCheck={false}
                                            autoFocus={true}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="config"
                            render={({ field: { value, onChange } }) => {
                                return (
                                    <FormItem>
                                        <FormLabel>Configuration</FormLabel>
                                        {/* @todo : refactor this description into a shared file */}
                                        <FormDescription>Code hosts are configured via a....TODO</FormDescription>
                                        <FormControl>
                                            <ConfigEditor<T>
                                                value={value}
                                                onChange={onChange}
                                                actions={quickActions ?? []}
                                                schema={schema}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )
                            }}
                        />
                    </div>
                    <Button className="mt-5" type="submit">Submit</Button>
                </form>
            </Form>
        </div>
    )
}