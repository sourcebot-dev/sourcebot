
'use client';

import { z } from "zod";
import Ajv from "ajv";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import CodeMirror from "@uiw/react-codemirror";

// @todo: generate this from the schema
const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
        type: {
            "const": "github"
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

export default function NewConnectionPage() {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            config: "",
        },
    });

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
                                        value={value}
                                        onChange={onChange}
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