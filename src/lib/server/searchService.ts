import escapeStringRegexp from "escape-string-regexp";
import { SHARD_MAX_MATCH_COUNT, TOTAL_MAX_MATCH_COUNT } from "../environment";
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, listRepositoriesResponseSchema, SearchRequest, SearchResponse, searchResponseSchema } from "../schemas";
import { fileNotFound, invalidZoektResponse, ServiceError, unexpectedError } from "../serviceError";
import { isServiceError } from "../utils";
import { zoektFetch } from "./zoektClient";
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai'; // Ensure OPENAI_API_KEY environment variable is set

export const search = async ({ query: _query, numResults, whole, semantic }: SearchRequest): Promise<SearchResponse | ServiceError> => {
    let query = _query;

    if (semantic) {
        query = await convertSemanticQueryToZoektQuery(query);
        console.log(`Generated query: ${query}`);
    }

    const body = JSON.stringify({
        q: query,
        // @see: https://github.com/TaqlaAI/zoekt/blob/main/api.go#L892
        opts: {
            NumContextLines: 2,
            ChunkMatches: true,
            MaxMatchDisplayCount: numResults,
            Whole: !!whole,
            ShardMaxMatchCount: SHARD_MAX_MATCH_COUNT,
            TotalMaxMatchCount: TOTAL_MAX_MATCH_COUNT,
        }
    });

    const searchResponse = await zoektFetch({
        path: "/api/search",
        body,
        method: "POST",
    });

    if (!searchResponse.ok) {
        return invalidZoektResponse(searchResponse);
    }

    const searchBody = await searchResponse.json();
    const parsedSearchResponse = searchResponseSchema.safeParse(searchBody);
    if (!parsedSearchResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedSearchResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return parsedSearchResponse.data;
}

export const getFileSource = async ({ fileName, repository }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const escapedFileName = escapeStringRegexp(fileName);
    const escapedRepository = escapeStringRegexp(repository);

    const searchResponse = await search({
        query: `${escapedFileName} repo:^${escapedRepository}$`,
        numResults: 1,
        whole: true,
    });

    if (isServiceError(searchResponse)) {
        return searchResponse;
    }

    const files = searchResponse.Result.Files;

    if (!files || files.length === 0) {
        return fileNotFound(fileName, repository);
    }

    const source = files[0].Content ?? '';
    return {
        source
    }
}

export const listRepositories = async (): Promise<ListRepositoriesResponse | ServiceError> => {
    const body = JSON.stringify({
        opts: {
            Field: 0,
        }
    });
    const listResponse = await zoektFetch({
        path: "/api/list",
        body,
        method: "POST",
        cache: "no-store",
    });

    if (!listResponse.ok) {
        return invalidZoektResponse(listResponse);
    }

    const listBody = await listResponse.json();
    const parsedListResponse = listRepositoriesResponseSchema.safeParse(listBody);
    if (!parsedListResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedListResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return parsedListResponse.data;
}

const convertSemanticQueryToZoektQuery = async (query: string) => {
    const { text } = await generateText({
        model: openai('gpt-4'),
        system:
        `
        You are tasked with converting natural language code search queries into Zoekt's query language. Zoekt queries are fundamentally composed of regular expressions (regex), with certain prefixes, infix operators, and boolean logic controlling their behavior. Your job is to accurately interpret semantic queries and apply the correct Zoekt syntax rules to ensure precise search results.

        Key Rules of Zoekt Query Syntax:
        
        1. Regex by Default:

        All queries are treated as regex by default. Special characters in the query are parsed as regex operators unless escaped.
        Example: A query for foo* matches any text starting with "foo" followed by any characters. To search for "foo*" literally, escape it as foo\\*.
        
        2. Multiple Expressions:

        Queries with multiple space-separated terms (expressions) are conjunctive. Each file must match all expressions to be included in the results.
        Example: foo bar searches for files containing both /foo/ and /bar/. To search for the phrase "foo bar", use quotes: "foo bar".
        
        3. Boolean Logic:

        or: Combines expressions to match any file that contains either expression.
        Example: foo or bar returns files matching /foo/ or /bar/.
        - (Negation): Excludes results that match the negated expression.
        Example: foo -bar returns files containing /foo/ but excluding those that also contain /bar/.
        Parentheses: Used to group expressions.
        Example: foo (bar or baz) returns files with /foo/ and either /bar/ or /baz/.
        
        4. Prefix Expressions:

        Specific prefixes restrict searches to particular parts of the codebase, like file names, contents, or repositories. Boolean logic applies to these as well.

        Common Prefixes:
        
        file: or f:: Restrict matches to file names.
        - Example: f:README.
        content: or c:: Restrict matches to file contents.
        - Example: c:README.
        repo: or r:: Match repository names.
        branch: or b:: Match branch names.
        lang:: Restrict matches to files in a specific language.
        Example: lang:typescript.
        sym:: Match symbol definitions using ctags information.
        case:: Adjust case sensitivity (case:yes for case-sensitive, case:no for case-insensitive).
        
        5. Special Handling:

        Use quotes for multi-word phrases or operators like or when meant literally: "foo or bar".
        Escape special characters in regex with backslashes if you want to match them literally.
        
        Instructions for Converting Semantic Queries:
        1. Understand the Query's Intent:

        Analyze the natural language query to understand its goal. Is the user looking for specific phrases, file names, function definitions, or other specific code elements?
        
        2. Determine the Right Regex:

        Convert phrases or keywords into regular expressions. Remember that Zoekt treats everything as a regex by default. Escape special characters as needed.
        Example: Convert “search for functions named main” to sym:\\bmain\\b.
        
        3. Use Boolean Logic:

        Combine expressions using or, -, and parentheses where necessary. For example, a query like "find either foo or bar, but not baz" translates to foo or bar -baz.
        
        4. Apply Prefixes:

        If the query specifies searching within file names, repositories, or other specific parts of the codebase, use appropriate prefixes like file:, repo:, or lang:.
        
        5. Respect Case Sensitivity:

        Consider whether case sensitivity matters based on the semantic query. Apply case:yes or case:no as needed. Output the zoekt query and nothing else.
        `,
        prompt: query
    })
    
    return text;
}