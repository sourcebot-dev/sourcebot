import { z } from "zod";
import { findSearchBasedSymbolReferencesResponseSchema, referenceSchema } from "./schemas";

export type FindSearchBasedSymbolReferencesResponse = z.infer<typeof findSearchBasedSymbolReferencesResponseSchema>;

export type Reference = z.infer<typeof referenceSchema>;
