import { z } from "zod";
import { findRelatedSymbolsResponseSchema } from "./schemas";

export type FindRelatedSymbolsResponse = z.infer<typeof findRelatedSymbolsResponseSchema>;
