import { McpServersPage } from "./mcpServersPage";

interface PageProps {
    searchParams: Promise<{
        status?: string;
        server?: string;
        message?: string;
    }>;
}

export default async function Page({ searchParams }: PageProps) {
    const { status, server, message } = await searchParams;
    return <McpServersPage callbackStatus={status} callbackServer={server} callbackMessage={message} />;
}
