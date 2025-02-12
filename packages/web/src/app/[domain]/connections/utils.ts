import Ajv, { Schema } from "ajv";
import { z } from "zod";

export const createZodConnectionConfigValidator = (jsonSchema: Schema) => {
    const ajv = new Ajv({
        validateFormats: false,
    });
    const validate = ajv.compile(jsonSchema);

    return z
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
        });
} 