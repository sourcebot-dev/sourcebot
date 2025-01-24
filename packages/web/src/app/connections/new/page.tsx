
'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";

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
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            config: JSON.stringify({ type: "github" }, null, 2),
        },
    });

    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();
    const { toast } = useToast();
    const router = useRouter();

    const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
        createConnection(data.config)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to create connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection created successfully!`
                    });
                    router.push('/');
                }
            });
    }, [router, toast]);

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Create a connection</h1>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="flex flex-col gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Display Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="config"
                            render={({ field: { value, onChange } }) => (
                                <FormItem>
                                    <FormLabel>Configuration</FormLabel>
                                    <FormControl>
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
                                        >
                                        </CodeMirror>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button className="mt-5" type="submit">Submit</Button>
                </form>
            </Form>
        </div>
    )
}