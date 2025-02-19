
'use client';

import { createConnection } from "@/actions";
import { ConnectionIcon } from "@/app/[domain]/connections/components/connectionIcon";
import { createZodConnectionConfigValidator } from "@/app/[domain]/connections/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isServiceError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Schema } from "ajv";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfigEditor, QuickActionFn } from "../configEditor";
import { useDomain } from "@/hooks/useDomain";
import { Loader2 } from "lucide-react";

interface SharedConnectionCreationFormProps<T> {
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
    className?: string;
    onCreated?: (id: number) => void;
}

export default function SharedConnectionCreationForm<T>({
    type,
    defaultValues,
    title,
    schema,
    quickActions,
    className,
    onCreated,
}: SharedConnectionCreationFormProps<T>) {

    const { toast } = useToast();
    const domain = useDomain();

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
    const { isSubmitting } = form.formState;

    const onSubmit = useCallback(async (data: z.infer<typeof formSchema>) => {
        const response = await createConnection(data.name, type, data.config, domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create connection. Reason: ${response.message}`
            });
        } else {
            toast({
                description: `✅ Connection created successfully.`
            });
            onCreated?.(response.id);
        }
    }, [domain, toast, type, onCreated]);

    return (
        <div className={cn("flex flex-col max-w-3xl mx-auto bg-background border rounded-lg p-6", className)}>
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
                    <Button
                        className="mt-5"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2" />}
                        Submit
                    </Button>
                </form>
            </Form>
        </div>
    )
}