
'use client';

import { createConnection } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getCodeHostIcon, isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import Ajv from "ajv";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfigEditor } from "../components/configEditor";

const ajv = new Ajv({
    validateFormats: false,
});

// @todo: we will need to validate the config against different schemas based on the type of connection.
const validate = ajv.compile(githubSchema);

const formSchema = z.object({
    name: z.string().min(1),
    config: z
        .string()
        .superRefine((data, ctx) => {
            const addIssue = (message: string) => {
                return ctx.addIssue({
                    code: "custom",
                    message: `Schema validation error: ${message}`
                });
            }

            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch {
                addIssue("Invalid JSON");
                return;
            }

            const valid = validate(parsed);
            if (!valid) {
                addIssue(ajv.errorsText(validate.errors));
            }
        }),
});

export default function NewConnectionPage() {

    const defaultConfig: GithubConnectionConfig = {
        type: 'github'
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            config: JSON.stringify(defaultConfig, null, 2),
            name: "my-github-connection"
        },
    });

    const { toast } = useToast();
    const router = useRouter();

    const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
        // @todo: we will need to key into the type of connection here
        const connectionType = 'github';
        createConnection(data.name, connectionType, data.config)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to create connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection created successfully!`
                    });
                    router.push('/connections');
                }
            });
    }, [router, toast]);

    return (
        <div className="flex flex-col max-w-3xl mx-auto bg-background border rounded-lg p-6">
            <div className="flex flex-row items-center gap-3 mb-6">
                <Image
                    src={getCodeHostIcon('github')!.src}
                    alt={''}
                    className="w-7 h-7"
                />
                <h1 className="text-3xl">Create a GitHub connection</h1>
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
                                    <FormDescription>This is the connection's display name within Sourcebot. Examples: <b>public-github</b>, <b>self-hosted-gitlab</b>, <b>gerrit-other</b>, etc. </FormDescription>
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
                                        <FormDescription>Code hosts are configured via a....</FormDescription>
                                        <FormControl>
                                            <ConfigEditor
                                                value={value}
                                                onChange={onChange}
                                                actions={[
                                                    {
                                                        fn: (previous: GithubConnectionConfig) => ({
                                                            ...previous,
                                                            orgs: [
                                                                ...(previous.orgs ?? []),
                                                                ""
                                                            ]
                                                        }),
                                                        name: "Add an organization",
                                                    },
                                                    {
                                                        fn: (previous: GithubConnectionConfig) => ({
                                                            ...previous,
                                                            url: previous.url ?? "",
                                                        }),
                                                        name: "Set a custom url",
                                                    },
                                                    {
                                                        fn: (previous: GithubConnectionConfig) => ({
                                                            ...previous,
                                                            repos: [
                                                                ...(previous.orgs ?? []),
                                                                ""
                                                            ]
                                                        }),
                                                        name: "Add a repo",
                                                    },
                                                    {
                                                        fn: (previous: GithubConnectionConfig) => ({
                                                            ...previous,
                                                            token: previous.token ?? {
                                                                env: "",
                                                            },
                                                        }),
                                                        name: "Add a secret",
                                                    }
                                                ]}
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