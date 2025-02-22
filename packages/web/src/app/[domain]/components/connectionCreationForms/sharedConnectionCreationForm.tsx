
'use client';

import { createConnection } from "@/actions";
import { ConnectionIcon } from "@/app/[domain]/connections/components/connectionIcon";
import { createZodConnectionConfigValidator } from "@/app/[domain]/connections/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CodeHostType, isServiceError, isAuthSupportedForCodeHost } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Schema } from "ajv";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ConfigEditor, { isConfigValidJson, onQuickAction, QuickActionFn } from "../configEditor";
import { useDomain } from "@/hooks/useDomain";
import { Loader2 } from "lucide-react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { SecretCombobox } from "./secretCombobox";
import strings from "@/lib/strings";

interface SharedConnectionCreationFormProps<T> {
    type: CodeHostType;
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
    const editorRef = useRef<ReactCodeMirrorRef>(null);

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
        onConfigChange(defaultValues.config);
    }, [defaultValues, onConfigChange]);

    const [isSecretsDisabled, setIsSecretsDisabled] = useState(false);
    const [secretKey, setSecretKey] = useState<string | undefined>(undefined);

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
                    <div className="flex flex-col gap-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Display Name</FormLabel>
                                    <FormDescription>This is the {`connection's`} display name within Sourcebot.</FormDescription>
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
                        {isAuthSupportedForCodeHost(type) && (
                            <div className="flex flex-col gap-2">
                                <FormLabel>Secret (optional)</FormLabel>
                                <FormDescription>{strings.createSecretDescription}</FormDescription>
                                <SecretCombobox
                                    isDisabled={isSecretsDisabled}
                                    secretKey={secretKey}
                                    codeHostType={type}
                                    onSecretChange={(secretKey) => {
                                        const view = editorRef.current?.view;
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
                            render={({ field: { value } }) => {
                                return (
                                    <FormItem>
                                        <FormLabel>Configuration</FormLabel>
                                        <FormDescription>{strings.connectionConfigDescription}</FormDescription>
                                        <FormControl>
                                            <ConfigEditor<T>
                                                ref={editorRef}
                                                value={value}
                                                onChange={onConfigChange}
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
                    <div className="flex flex-row justify-end">
                        <Button
                            className="mt-5"
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
                            Submit
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}