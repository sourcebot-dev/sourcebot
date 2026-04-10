import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { confirmAction } from "../utils";

const chatNames = [
    "How does the auth middleware work?",
    "Explain the search indexing pipeline",
    "Where are API routes defined?",
    "How to add a new database migration",
    "What is the repo sync process?",
    "Understanding the chat architecture",
    "How does SSO integration work?",
    "Explain the permission model",
    "Where is the webhook handler?",
    "How to configure environment variables",
    "Understanding the billing system",
    "How does the worker process jobs?",
    "Explain the caching strategy",
    "Where are the shared types defined?",
    "How does code search ranking work?",
    "Understanding the notification system",
    "How to add a new API endpoint",
    "Explain the deployment pipeline",
    "Where is error handling centralized?",
    "How does real-time updates work?",
    "Understanding the plugin system",
    "How to write integration tests",
    "Explain the file indexing process",
    "Where are the email templates?",
    "How does rate limiting work?",
    "Understanding the monorepo structure",
    "How to add a new feature flag",
    "Explain the logging setup",
    "Where is the GraphQL schema?",
    "How does the sidebar component work?",
];

export const injectChatData: Script = {
    run: async (prisma: PrismaClient) => {
        const orgId = 1;

        const org = await prisma.org.findUnique({
            where: { id: orgId }
        });

        if (!org) {
            console.error(`Organization with id ${orgId} not found.`);
            return;
        }

        const userIdArg = process.argv.find(arg => arg.startsWith("--user-id="))?.split("=")[1];

        const user = userIdArg
            ? await prisma.user.findUnique({ where: { id: userIdArg } })
            : await prisma.user.findFirst({
                where: {
                    orgs: {
                        some: { orgId }
                    }
                }
            });

        if (!user) {
            console.error(userIdArg
                ? `User with id "${userIdArg}" not found.`
                : `No user found in org ${orgId}.`
            );
            return;
        }

        await confirmAction(`This will create ${chatNames.length} chats for user "${user.name ?? user.email}" in org ${orgId}.`);

        for (const name of chatNames) {
            await prisma.chat.create({
                data: {
                    name,
                    orgId,
                    createdById: user.id,
                    messages: [],
                }
            });
        }

        console.log(`Created ${chatNames.length} chats.`);
    }
};
