import { createOpenAI } from "@ai-sdk/openai"
import { extractReasoningMiddleware, streamText, wrapLanguageModel } from "ai"
import { env } from "@/env.mjs"
import { tools } from "@/features/chat/tools"
import { SYSTEM_PROMPT } from "@/features/chat/constants"

const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
});


// Check if API key is configured
if (!env.OPENAI_API_KEY) {
    console.warn("Chat API: OPENAI_API_KEY is not configured")
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json()

        // System message for reasoning and context
        const systemMessage = {
            role: "system" as const,
            content: SYSTEM_PROMPT,
        }

        // const contextWindow = {
        //     role: "system" as const,
        //     content: JSON.stringify(mockFileContext),
        // }

        const result = streamText({
            model: wrapLanguageModel({
                model: openai("o3-mini"),
                middleware: [
                    extractReasoningMiddleware({
                        tagName: 'reasoning',
                    })
                ]
            }),
            messages: [
                systemMessage,
                // contextWindow,
                ...messages
            ],
            tools,
            temperature: 0.3, // Lower temperature for more focused reasoning
            maxTokens: 4000, // Increased for tool results and responses
            toolChoice: "auto", // Let the model decide when to use tools
            maxSteps: 20,
            onStepFinish: (step) => {
                console.log("Chat API: Step finished:", step.stepType, step.isContinued)
                if (step.toolCalls) {
                    console.log("Chat API: Tool calls in step:", step.toolCalls.length)
                }
                if (step.toolResults) {
                    console.log("Chat API: Tool results in step:", step.toolResults.length)
                }
            }
        })

        return result.toDataStreamResponse({
            // @see: https://ai-sdk.dev/docs/troubleshooting/use-chat-an-error-occurred
            getErrorMessage: errorHandler
        })
    } catch (error) {
        console.error("Chat API error:", error)
        console.error("Chat API error stack:", error instanceof Error ? error.stack : "No stack trace")
        return new Response(JSON.stringify({ 
            error: "Failed to process chat request",
            details: error instanceof Error ? error.message : "Unknown error"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
}

export function errorHandler(error: unknown) {
    if (error == null) {
      return 'unknown error';
    }
  
    if (typeof error === 'string') {
      return error;
    }
  
    if (error instanceof Error) {
      return error.message;
    }
  
    return JSON.stringify(error);
  }

const mockFileContext = {
    path: "packages/web/src/auth.ts",
    name: "auth.ts",
    repository: "github.com/sourcebot-dev/sourcebot",
    revision: "HEAD",
    content: `
import 'next-auth/jwt';
import NextAuth, { DefaultSession, User as AuthJsUser } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/prisma";
import { env } from "@/env.mjs";
import { User } from '@sourcebot/db';
import 'next-auth/jwt';
import type { Provider } from "next-auth/providers";
import { verifyCredentialsRequestSchema } from './lib/schemas';
import { createTransport } from 'nodemailer';
import { render } from '@react-email/render';
import MagicLinkEmail from './emails/magicLinkEmail';
import bcrypt from 'bcryptjs';
import { getSSOProviders } from '@/ee/sso/sso';
import { hasEntitlement } from '@/features/entitlements/server';
import { onCreateUser } from '@/lib/authUtils';

export const runtime = 'nodejs';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
        } & DefaultSession['user'];
    }
}


declare module 'next-auth/jwt' {
    interface JWT {
        userId: string
    }
}

export const getProviders = () => {
    const providers: Provider[] = [];

    if (hasEntitlement("sso")) {
        providers.push(...getSSOProviders());
    }

    if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS && env.AUTH_EMAIL_CODE_LOGIN_ENABLED === 'true') {
        providers.push(EmailProvider({
            server: env.SMTP_CONNECTION_URL,
            from: env.EMAIL_FROM_ADDRESS,
            maxAge: 60 * 10,
            generateVerificationToken: async () => {
                const token = String(Math.floor(100000 + Math.random() * 900000));
                return token;
            },
            sendVerificationRequest: async ({ identifier, provider, token }) => {
                const transport = createTransport(provider.server);
                const html = await render(MagicLinkEmail({ token: token }));
                const result = await transport.sendMail({
                    to: identifier,
                    from: provider.from,
                    subject: 'Log in to Sourcebot',
                    html,
                    text: \`Log in to Sourcebot using this code: \${token}\`
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length) {
                    throw new Error(\`Email(s) (\${failed.join(", ")}) could not be sent\`);
                }
            }
        }));
    }

    if (env.AUTH_CREDENTIALS_LOGIN_ENABLED === 'true') {
        providers.push(Credentials({
            credentials: {
                email: {},
                password: {}
            },
            type: "credentials",
            authorize: async (credentials) => {
                const body = verifyCredentialsRequestSchema.safeParse(credentials);
                if (!body.success) {
                    return null;
                }
                const { email, password } = body.data;

                const user = await prisma.user.findUnique({
                    where: { email }
                });

                // The user doesn't exist, so create a new one.
                if (!user) {
                    const hashedPassword = bcrypt.hashSync(password, 10);
                    const newUser = await prisma.user.create({
                        data: {
                            email,
                            hashedPassword,
                        }
                    });

                    const authJsUser: AuthJsUser = {
                        id: newUser.id,
                        email: newUser.email,
                    }

                    onCreateUser({ user: authJsUser });
                    return authJsUser;

                    // Otherwise, the user exists, so verify the password.
                } else {
                    if (!user.hashedPassword) {
                        return null;
                    }

                    if (!bcrypt.compareSync(password, user.hashedPassword)) {
                        return null;
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name ?? undefined,
                        image: user.image ?? undefined,
                    };
                }
            }
        }));
    }

    return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: env.AUTH_SECRET,
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    trustHost: true,
    events: {
        createUser: onCreateUser,
    },
    callbacks: {
        async jwt({ token, user: _user }) {
            const user = _user as User | undefined;
            // @note: \`user\` will be available on signUp or signIn triggers.
            // Cache the userId in the JWT for later use.
            if (user) {
                token.userId = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // @WARNING: Anything stored in the session will be sent over
            // to the client.
            session.user = {
                ...session.user,
                // Propogate the userId to the session.
                id: token.userId,
            }
            return session;
        },
    },
    providers: getProviders(),
    pages: {
        signIn: "/login",
        // We set redirect to false in signInOptions so we can pass the email is as a param
        // verifyRequest: "/login/verify",
    }
});
    `,
}