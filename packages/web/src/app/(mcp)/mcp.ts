import { z } from "zod";
import { initializeMcpApiHandler } from "./mcp-api-handler";
import { search } from "@/lib/server/searchService";
import { isServiceError } from "@/lib/utils";
import { env } from "@/env.mjs";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";

const searchParams = z.object({
    query: z
        .string()
        .describe(`
            The Sourcebot search query.

            The query syntax follows the following EBNF grammar:

            '''
            (* Top-level query definition *)
            Query ::= Expression | Expression Query ;

            (* Core expressions *)
            Expression ::= SimpleExpression | ComplexExpression | BooleanExpression | ParenExpression ;

            (* Simple expression is a regex match *)
            SimpleExpression ::= RegexLiteral ;

            (* Complex expressions with prefixes *)
            ComplexExpression ::= Prefix RegexLiteral ;

            *)
            Prefix ::=
                "file:" | (* Include only results from filepaths matching the given search pattern. Must be a full path to a file. *)
                "repo:" | (* Include only results from the given repository. Must be a full repository url and regex-escaped. (e.g., "github\.com\/sourcebot\/sourcebot-dev") *)
                "lang:" | (* Include only results from the given language. The language must be formatted as a GitHub linguist language. *)
                "sym:" | (* Include only results from the given symbol. The symbol can be a function, class, variable, etc. *)
                "case:" | (* Include only results from the given case. Accepted values are "auto" (default), "yes", and "no". *)
                "archived:" | (* Include only results from archived repositories. Accepted values are "yes" and "no". *)
                "fork:" | (* Include only results from forked repositories. Accepted values are "yes" and "no". *)
                "public:" | (* Include only results from public repositories. Accepted values are "yes" and "no". *)
            ;

            (* Boolean expressions *)
            BooleanExpression ::= NegatedExpression | DisjunctiveExpression ;

            (* Negated expression with dash *)
            NegatedExpression ::= "-" Expression ;

            (* Disjunctive expression with OR *)
            DisjunctiveExpression ::= Expression "or" Expression ;

            (* Parenthesized expression for grouping *)
            ParenExpression ::= "(" Query ")" ;

            (* Regex literal can be quoted or unquoted *)
            RegexLiteral ::= QuotedRegex | UnquotedRegex ;

            (* Quoted regex is wrapped in double quotes *)
            QuotedRegex ::= '"' RegexChar* '"' ;

            (* Unquoted regex cannot contain spaces unless escaped *)
            UnquotedRegex ::= (RegexCharNoSpace | EscapedSpace)+ ;

            (* Regular regex character excluding spaces *)
            RegexCharNoSpace ::= ? any character except space or " ? ;

            (* Regular regex character including spaces when quoted *)
            RegexChar ::= ? any character except " ? ;

            (* Escaped space character *)
            EscapedSpace ::= "\ " ;
            '''
        `)
});

export const mcpHandler = initializeMcpApiHandler(
    (server) => {
        server.tool(
            "search_code",
            "Search for code across the Sourcebot instance.",
            searchParams.shape,
            async ({ query }: z.infer<typeof searchParams>) => {
                if (env.SOURCEBOT_TENANCY_MODE !== 'single') {
                    return {
                        content: [{ type: "text", text: "This feature is not available in multi-tenant mode." }],
                    }
                }

                const searchResponse = await search({
                    query,
                    maxMatchDisplayCount: 100,
                }, SINGLE_TENANT_ORG_ID);

                if (isServiceError(searchResponse)) {
                    return {
                        content: [{ type: "text", text: `Error: ${searchResponse.message}` }],
                    }
                }

                return {
                    content: [{ type: "text", text: `Search response: ${JSON.stringify(searchResponse, null, 2)}` }],
                }
            }
        )
    },
    {
        capabilities: {
            tools: {
                echo: {
                    description: "Echo a message",
                },
            },
        },
    }
);
