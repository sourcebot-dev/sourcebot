import { z } from "zod";

export const listChatsQueryParamsSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().default(20),
    query: z.string().optional(),
    sortBy: z.enum(["name", "updatedAt"]).default("updatedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const listChatsResponseSchema = z.object({
    chats: z.array(z.object({
        id: z.string(),
        name: z.string().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })),
    nextCursor: z.string().nullable(),
});



export type ListChatsQueryParams = z.input<typeof listChatsQueryParamsSchema>;
export type ListChatsResponse = z.infer<typeof listChatsResponseSchema>;
