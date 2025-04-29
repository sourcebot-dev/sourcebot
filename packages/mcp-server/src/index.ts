// Entry point for the MCP server
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { randomUUID } from 'node:crypto';

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
        console.log(`executing query: ${query}`);

        const searchRequest: SearchRequest = {
            query,
            maxMatchDisplayCount: 100,
        }

        const response = await fetch('http://localhost:3000/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchRequest)
        });

        const searchResults = await response.json();

        return {
            content: [{ type: "text", text: String(JSON.stringify(searchResults, null, 2)) }]
        }
    }
);

// Create Express app
const app = express();
app.use(express.json());


// Store transports for each session type
const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>
};

app.all('/mcp', async (req: Request, res: Response) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.streamable[sessionId]) {
        transport = transports.streamable[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
                transports.streamable[sessionId] = transport;
            }
        });

        transport.onclose = () => {
            if (transport.sessionId) {
                delete transports.streamable[transport.sessionId];
            }
        }

        await server.connect(transport);
    } else {
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided',
            },
            id: null,
        });
        return;
    }

    await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.streamable[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    const transport = transports.streamable[sessionId];
    await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

// Legacy message endpoint for older clients
// @see: https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#server-side-compatibility
app.get('/sse', async (_req: Request, res: Response) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on("close", () => {
        delete transports.sse[transport.sessionId];
    });

    await server.connect(transport);
});

// Legacy message endpoint for older clients
// @see: https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#server-side-compatibility
app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res, req.body);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

// Start server
const port = 6071;
app.listen(port, () => {
    console.log(`Sourcebot MCP server listening on port ${port}`);
});

