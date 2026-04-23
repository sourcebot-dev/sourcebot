import { authenticatedPage } from "@/middleware/authenticatedPage";
import { NavigationMenu } from "@/app/(app)/components/navigationMenu";
import { AgentConfigForm } from "../agentConfigForm";
import { OrgRole } from "@sourcebot/db";

export default authenticatedPage(async ({ prisma, org }) => {
    const connections = await prisma.connection.findMany({
        where: { orgId: org.id },
        select: { id: true, name: true, connectionType: true },
        orderBy: { name: "asc" },
    });

    const reposRaw = await prisma.repo.findMany({
        where: { orgId: org.id },
        select: { id: true, displayName: true, external_id: true, external_codeHostType: true },
        orderBy: { displayName: "asc" },
    });
    const repos = reposRaw.map(r => ({ id: r.id, displayName: r.displayName, externalId: r.external_id, externalCodeHostType: r.external_codeHostType }));

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu />
            <div className="w-full max-w-3xl px-4 mt-12 mb-24">
                <h1 className="text-2xl font-semibold text-foreground mb-8">New agent config</h1>
                <AgentConfigForm connections={connections} repos={repos} />
            </div>
        </div>
    );
}, { minRole: OrgRole.OWNER, redirectTo: '/agents' });
