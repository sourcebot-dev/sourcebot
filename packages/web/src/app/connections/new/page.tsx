
'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { zodResolver } from "@hookform/resolvers/zod";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import Ajv from "ajv";
import {
    handleRefresh,
    jsonCompletion,
    jsonSchemaHover,
    jsonSchemaLinter,
    stateExtensions
} from "codemirror-json-schema";
import { useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { createConnection } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { getCodeHostIcon, isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

// Add this theme extension to your extensions array
const customAutocompleteStyle = EditorView.baseTheme({
    ".cm-tooltip.cm-completionInfo": {
        padding: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
    },
    ".cm-tooltip-hover.cm-tooltip": {
        padding: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
    }
})

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

    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();
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

                                const onQuickAction = (e: any, action: (config: GithubConnectionConfig) => GithubConnectionConfig) => {
                                    e.preventDefault();
                                    let parsedConfig: GithubConnectionConfig;
                                    try {
                                        parsedConfig = JSON.parse(value) as GithubConnectionConfig;
                                    } catch {
                                        return;
                                    }

                                    onChange(JSON.stringify(
                                        action(parsedConfig),
                                        null,
                                        2
                                    ));

                                    // todo: need to figure out how we can move the codemirror cursor
                                    // into the correct location.
                                }

                                return (
                                    <FormItem>
                                        <FormLabel>Configuration</FormLabel>
                                        <FormDescription>Code hosts are configured via a....</FormDescription>
                                        <div className="flex flex-row items-center gap-x-1 flex-wrap w-full">
                                            <Button
                                                className="h-8 rounded-md px-3"
                                                variant="ghost"
                                                onClick={(e) => onQuickAction(e, (config) => ({
                                                    ...config,
                                                    orgs: [
                                                        ...(config.orgs ?? []),
                                                        ""
                                                    ]
                                                }))}
                                            >
                                                Add an organization
                                            </Button>
                                            <Separator orientation="vertical" className="h-4" />
                                            <Button
                                                className="h-8 rounded-md px-3"
                                                variant="ghost"
                                                onClick={(e) => onQuickAction(e, (config) => ({
                                                    ...config,
                                                    url: config.url ?? "",
                                                }))}
                                            >
                                                Set a custom url
                                            </Button>
                                        </div>
                                        <FormControl>
                                            <ScrollArea className="rounded-md border p-1 overflow-auto flex-1 h-64">
                                                <CodeMirror
                                                    ref={editorRef}
                                                    value={value}
                                                    onChange={onChange}
                                                    extensions={[
                                                        keymapExtension,
                                                        json(),
                                                        linter(jsonParseLinter(), {
                                                            delay: 300,
                                                        }),
                                                        linter(jsonSchemaLinter(), {
                                                            needsRefresh: handleRefresh,
                                                        }),
                                                        jsonLanguage.data.of({
                                                            autocomplete: jsonCompletion(),
                                                        }),
                                                        hoverTooltip(jsonSchemaHover()),
                                                        // @todo: we will need to validate the config against different schemas based on the type of connection.
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        stateExtensions(githubSchema as any),
                                                        customAutocompleteStyle,
                                                    ]}
                                                    theme={theme === "dark" ? "dark" : "light"}
                                                />
                                            </ScrollArea>
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