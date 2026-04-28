import { authenticatedPage } from "@/middleware/authenticatedPage";
import { NavigationMenu } from "@/app/(app)/components/navigationMenu";
import { AgentConfigForm } from "../agentConfigForm";
import { notFound } from "next/navigation";
import { OrgRole } from "@sourcebot/db";

type Props = {
    params: Promise<{ agentId: string }>;
};

export default authenticatedPage(async ({ prisma, org }, { params }: Props) => {
    const { agentId } = await params;

    const [config, connections, reposRaw] = await Promise.all([
        prisma.agentConfig.findFirst({
            where: { id: agentId, orgId: org.id },
            include: {
                repos: { select: { repoId: true } },
                connections: { select: { connectionId: true } },
            },
        }),
        prisma.connection.findMany({
            where: { orgId: org.id },
            select: { id: true, name: true, connectionType: true },
            orderBy: { name: "asc" },
        }),
        prisma.repo.findMany({
            where: { orgId: org.id },
            select: { id: true, displayName: true, external_id: true, external_codeHostType: true },
            orderBy: { displayName: "asc" },
        }),
    ]);

    if (!config) {
        notFound();
    }

    const repos = reposRaw.map(r => ({ id: r.id, displayName: r.displayName, externalId: r.external_id, externalCodeHostType: r.external_codeHostType }));

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu />
            <div className="w-full max-w-3xl px-4 mt-12 mb-24">
                <h1 className="text-2xl font-semibold text-foreground mb-8">Edit agent config</h1>
                <AgentConfigForm
                    initialValues={{
                        id: config.id,
                        name: config.name,
                        description: config.description ?? "",
                        type: config.type,
                        enabled: config.enabled,
                        prompt: config.prompt ?? "",
                        promptMode: config.promptMode,
                        scope: config.scope,
                        repoIds: config.repos.map((r) => r.repoId),
                        connectionIds: config.connections.map((c) => c.connectionId),
                        settings: config.settings as Record<string, unknown>,
                    }}
                    connections={connections}
                    repos={repos}
                />
            </div>
        </div>
    );
}, { minRole: OrgRole.OWNER, redirectTo: '/agents' });
