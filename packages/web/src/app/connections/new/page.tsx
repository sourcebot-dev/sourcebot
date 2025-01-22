
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
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";


// @todo: generate this from the schema
const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
        type: {
            "const": "github",
            "description": "GitHub Configuration",
        }
    },
    required: ["type"],
    additionalProperties: false,
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

const formSchema = z.object({
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
            config: "",
        },
    });

    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Create a connection</h1>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(() => { })}>
                    <FormField
                        control={form.control}
                        name="config"
                        render={({ field: { value, onChange } }) => (
                            <FormItem>
                                <FormLabel>aksjdflkj</FormLabel>
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
                                            stateExtensions(schema as any),
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
                    <Button className="mt-5" type="submit">Submit</Button>
                </form>
            </Form>
        </div>
    )
}