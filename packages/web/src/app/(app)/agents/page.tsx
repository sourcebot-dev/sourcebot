import Link from "next/link";
import { NavigationMenu } from "../components/navigationMenu";
import { FaCogs } from "react-icons/fa";
import { env } from "@sourcebot/shared";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Settings2 } from "lucide-react";

const integrations = [
    {
        id: "github-review-agent",
        name: "GitHub Review Agent",
        description: "An AI code review agent that reviews your GitHub PRs. Uses the code indexed on Sourcebot to provide codebase-wide context.",
        requiredEnvVars: ["GITHUB_REVIEW_AGENT_APP_ID", "GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET", "GITHUB_REVIEW_AGENT_APP_PRIVATE_KEY_PATH"],
        configureUrl: "https://docs.sourcebot.dev/docs/features/agents/review-agent",
    },
    {
        id: "gitlab-review-agent",
        name: "GitLab Review Agent",
        description: "An AI code review agent that reviews your GitLab MRs. Uses the code indexed on Sourcebot to provide codebase-wide context.",
        requiredEnvVars: ["GITLAB_REVIEW_AGENT_WEBHOOK_SECRET", "GITLAB_REVIEW_AGENT_TOKEN"],
        configureUrl: "https://docs.sourcebot.dev/docs/features/agents/review-agent",
    },
];

const scopeLabels: Record<string, string> = {
    ORG: "Org-wide",
    CONNECTION: "Connection",
    REPO: "Repo",
};

const typeLabels: Record<string, string> = {
    CODE_REVIEW: "Code Review",
};

export default authenticatedPage(async ({ prisma, org }) => {
    const agentConfigs = await prisma.agentConfig.findMany({
        where: { orgId: org.id },
        include: {
            repos: {
                include: {
                    repo: { select: { id: true, displayName: true } },
                },
            },
            connections: {
                include: {
                    connection: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu />
            <div className="w-full max-w-6xl px-4 mt-12 mb-24 space-y-12">

                {/* Integration status cards */}
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-6">Integrations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {integrations.map((agent) => {
                            const isConfigured = agent.requiredEnvVars.every(
                                (envVar) => envVar in env && env[envVar as keyof typeof env] !== undefined
                            );
                            return (
                                <div
                                    key={agent.id}
                                    className="relative flex flex-col items-center border border-border rounded-2xl p-8 bg-card shadow-xl"
                                >
                                    <div className="flex flex-col items-center w-full">
                                        <h3 className="font-bold text-xl mb-3 mt-2 text-center text-foreground drop-shadow-sm">
                                            {agent.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground text-center mb-4 min-h-[56px]">
                                            {agent.description}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-center w-full mt-2">
                                        {isConfigured ? (
                                            <div className="text-green-500 font-semibold text-sm">
                                                Configured — accepting requests on /api/webhook
                                            </div>
                                        ) : (
                                            <Link
                                                href={agent.configureUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-mono font-semibold text-sm border border-primary shadow-sm hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/60 transition w-1/2"
                                            >
                                                <FaCogs className="text-base" /> Configure
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Agent configurations */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Agent Configurations</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Customise agent behaviour per repository, connection, or the whole org.
                            </p>
                        </div>
                        <Button asChild size="sm">
                            <Link href="/agents/configs/new">
                                <Plus className="w-4 h-4 mr-2" />
                                New config
                            </Link>
                        </Button>
                    </div>

                    {agentConfigs.length === 0 ? (
                        <div className="border border-dashed border-border rounded-xl p-12 text-center">
                            <Settings2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-muted-foreground text-sm">
                                No agent configurations yet. Create one to customise the prompt, scope, and model for your agents.
                            </p>
                            <Button asChild variant="outline" size="sm" className="mt-4">
                                <Link href="/agents/configs/new">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create first config
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {agentConfigs.map((config) => {
                                const scopeDetail =
                                    config.scope === "REPO"
                                        ? config.repos.map((r) => r.repo.displayName ?? r.repo.id).join(", ")
                                        : config.scope === "CONNECTION"
                                        ? config.connections.map((c) => c.connection.name).join(", ")
                                        : null;

                                return (
                                    <div
                                        key={config.id}
                                        className="flex items-center justify-between border border-border rounded-xl px-6 py-4 bg-card hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-start gap-4 min-w-0">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-foreground truncate">
                                                        {config.name}
                                                    </span>
                                                    <Badge variant={config.enabled ? "default" : "secondary"} className="text-xs">
                                                        {config.enabled ? "Enabled" : "Disabled"}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {typeLabels[config.type] ?? config.type}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {scopeLabels[config.scope] ?? config.scope}
                                                        {scopeDetail ? `: ${scopeDetail}` : ""}
                                                    </Badge>
                                                </div>
                                                {config.description && (
                                                    <p className="text-sm text-muted-foreground mt-1 truncate max-w-xl">
                                                        {config.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button asChild variant="ghost" size="sm" className="shrink-0 ml-4">
                                            <Link href={`/agents/configs/${config.id}`}>
                                                <Settings2 className="w-4 h-4 mr-2" />
                                                Edit
                                            </Link>
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
});
