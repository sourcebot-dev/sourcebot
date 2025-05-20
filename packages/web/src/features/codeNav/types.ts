import { z } from "zod";
import { findSearchBasedSymbolReferencesResponseSchema } from "./schemas";

export type FindSearchBasedSymbolReferencesResponse = z.infer<typeof findSearchBasedSymbolReferencesResponseSchema>;
