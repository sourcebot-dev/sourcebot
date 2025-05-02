// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { env } from './env.js';

// todo: refactor this to the schemas package
const searchRequestSchema = z.object({
    query: z.string(),
    maxMatchDisplayCount: z.number(),
    whole: z.boolean().optional(),
});

type SearchRequest = z.infer<typeof searchRequestSchema>;

// Create MCP server
const server = new McpServer({
    name: 'sourcebot-mcp-server',
    version: '0.1.0',
});

// Add search_code tool
server.tool(
    "search_code",
    "Search for code across the Sourcebot instance.",
    {
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
            `),
    },
    async ({ query }) => {
        console.error(`executing query: ${query}`);

        const searchRequest: SearchRequest = {
            query,
            maxMatchDisplayCount: 100,
        }

        const response = await fetch(`${env.SOURCEBOT_HOST}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Org-Domain': '~'
            },
            body: JSON.stringify(searchRequest)
        });

        const searchResults = await response.json();

        return {
            content: [{ type: "text", text: String(JSON.stringify(searchResults, null, 2)) }]
        }
    }
);


const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Sourcebot MCP server ready');
}

runServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});
