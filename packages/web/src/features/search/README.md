# `/search`

Code search interface for Sourcebot.

## Overview

The search feature parses user queries into an intermediate representation (IR), which is then executed against Zoekt's gRPC search backend. Query parsing uses Lezer for syntax analysis.

## Architecture

**Query Flow:**
1. User query string → Lezer parser (via `@sourcebot/query-language`)
2. Lezer syntax tree → Query IR (Zoekt gRPC `Q` proto)
3. Query IR → Zoekt backend → Search results

## Files

- **`index.ts`** - Public API exports for the search feature, including search functions and type definitions.

- **`parser.ts`** - Parses query strings into the query IR using the Lezer parser from `@sourcebot/query-language`.

- **`ir.ts`** - Defines the `QueryIR` type (internally the Zoekt gRPC `Q` proto) and provides utilities for traversing and querying the IR tree structure.

- **`types.ts`** - TypeScript types and Zod schemas for search requests, responses, file matches, stats, and streaming results.

- **`searchApi.ts`** - High-level search API that handles authentication, permission filtering, and orchestrates the query parsing and Zoekt backend calls.

- **`zoektSearcher.ts`** - Low-level interface to the Zoekt gRPC backend. Handles request construction, streaming search, response transformation, and repository metadata resolution.

- **`fileSourceApi.ts`** - Retrieves full file contents by executing a specialized search query against Zoekt for a specific file path.

