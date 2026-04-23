'use client';

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { AgentScope, AgentType, PromptMode } from "@sourcebot/db";

type Connection = { id: number; name: string; connectionType: string };
type Repo = { id: number; displayName: string | null; externalId: string; externalCodeHostType: string };
type ModelInfo = { provider: string; model: string; displayName: string };

type InitialValues = {
    id: string;
    name: string;
    description: string;
    type: AgentType;
    enabled: boolean;
    prompt: string;
    promptMode: PromptMode;
    scope: AgentScope;
    repoIds: number[];
    connectionIds: number[];
    settings: Record<string, unknown>;
};

type Props = {
    initialValues?: InitialValues;
    connections: Connection[];
    repos: Repo[];
};

const DEFAULT_TYPE: AgentType = AgentType.CODE_REVIEW;
const DEFAULT_SCOPE: AgentScope = AgentScope.ORG;
const DEFAULT_PROMPT_MODE: PromptMode = PromptMode.APPEND;

export function AgentConfigForm({ initialValues, connections, repos }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);

    const isEditing = !!initialValues?.id;

    const [name, setName] = useState(initialValues?.name ?? "");
    const [description, setDescription] = useState(initialValues?.description ?? "");
    const [type] = useState<AgentType>(initialValues?.type ?? DEFAULT_TYPE);
    const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
    const [prompt, setPrompt] = useState(initialValues?.prompt ?? "");
    const [promptMode, setPromptMode] = useState<PromptMode>(initialValues?.promptMode ?? DEFAULT_PROMPT_MODE);
    const [scope, setScope] = useState<AgentScope>(initialValues?.scope ?? DEFAULT_SCOPE);
    const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>(initialValues?.repoIds ?? []);
    const [selectedConnectionIds, setSelectedConnectionIds] = useState<number[]>(initialValues?.connectionIds ?? []);
    const [repoFilter, setRepoFilter] = useState("");
    const [connectionFilter, setConnectionFilter] = useState("");
    const [model, setModel] = useState<string>((initialValues?.settings?.model as string) ?? "");
    const [reviewCommand, setReviewCommand] = useState<string>((initialValues?.settings?.reviewCommand as string) ?? "");
    const [contextFiles, setContextFiles] = useState<string>((initialValues?.settings?.contextFiles as string) ?? "");
    const [autoReviewEnabled, setAutoReviewEnabled] = useState<boolean | undefined>(
        initialValues?.settings?.autoReviewEnabled as boolean | undefined
    );
    const [configuredModels, setConfiguredModels] = useState<ModelInfo[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    useEffect(() => {
        fetch('/api/models')
            .then((res) => res.ok ? res.json() : [])
            .then((data: ModelInfo[]) => setConfiguredModels(data))
            .catch(() => setConfiguredModels([]))
            .finally(() => setIsLoadingModels(false));
    }, []);

    const buildPayload = () => ({
        name,
        description: description || undefined,
        type,
        enabled,
        prompt: prompt || undefined,
        promptMode,
        scope,
        repoIds: scope === AgentScope.REPO ? selectedRepoIds : undefined,
        connectionIds: scope === AgentScope.CONNECTION ? selectedConnectionIds : undefined,
        settings: {
            ...(autoReviewEnabled !== undefined && { autoReviewEnabled }),
            ...(reviewCommand && { reviewCommand }),
            ...(model && { model }),
            ...(contextFiles && { contextFiles }),
        },
    });

    const handleSubmit = () => {
        startTransition(async () => {
            try {
                const payload = buildPayload();
                const url = isEditing ? `/api/agents/${initialValues!.id}` : `/api/agents`;
                const method = isEditing ? "PATCH" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    toast({
                        title: "Error",
                        description: err.message ?? "Failed to save agent config",
                        variant: "destructive",
                    });
                    return;
                }

                toast({
                    title: isEditing ? "Config updated" : "Config created",
                    description: `Agent config '${name}' was ${isEditing ? "updated" : "created"} successfully.`,
                });
                router.push("/agents");
            } catch {
                toast({
                    title: "Error",
                    description: "Failed to save agent config",
                    variant: "destructive",
                });
            }
        });
    };

    const handleDelete = async () => {
        if (!initialValues?.id) {
            return;
        }

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/agents/${initialValues.id}`, { method: "DELETE" });

            if (!res.ok) {
                toast({ title: "Error", description: "Failed to delete agent config", variant: "destructive" });
                return;
            }

            toast({ title: "Config deleted", description: `Agent config '${name}' was deleted.` });
            router.push("/agents");
        } catch {
            toast({ title: "Error", description: "Failed to delete agent config", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleRepoId = (id: number) => {
        setSelectedRepoIds((prev) =>
            prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
        );
    };

    const toggleConnectionId = (id: number) => {
        setSelectedConnectionIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-8">
            {/* Basic info */}
            <section className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">General</h2>

                <div className="space-y-2">
                    <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Security review"
                        maxLength={255}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional description"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <Switch
                        id="enabled"
                        checked={enabled}
                        onCheckedChange={setEnabled}
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                </div>
            </section>

            {/* Scope */}
            <section className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Scope</h2>
                <p className="text-sm text-muted-foreground">
                    Determines which repositories this config applies to. More specific scopes take priority: Repo &gt; Connection &gt; Org.
                </p>

                <div className="space-y-2">
                    <Label>Applies to</Label>
                    <Select value={scope} onValueChange={(v) => setScope(v as AgentScope)}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={AgentScope.ORG}>All repositories (org-wide)</SelectItem>
                            <SelectItem value={AgentScope.CONNECTION}>Specific connections</SelectItem>
                            <SelectItem value={AgentScope.REPO}>Specific repositories</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {scope === AgentScope.REPO && (() => {
                    const lc = repoFilter.toLowerCase();
                    const visible = repos.filter((r) =>
                        (r.displayName ?? r.externalId).toLowerCase().includes(lc)
                    );
                    const hiddenSelected = selectedRepoIds.filter(
                        (id) => !visible.some((r) => r.id === id)
                    ).length;
                    return (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Repositories</Label>
                                {selectedRepoIds.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        {selectedRepoIds.length} selected
                                        {hiddenSelected > 0 && ` (${hiddenSelected} not shown)`}
                                    </span>
                                )}
                            </div>
                            {repos.length > 0 && (
                                <Input
                                    placeholder="Filter repositories…"
                                    value={repoFilter}
                                    onChange={(e) => setRepoFilter(e.target.value)}
                                />
                            )}
                            <div className="border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
                                {repos.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">No repositories found.</p>
                                ) : visible.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">No repositories match &ldquo;{repoFilter}&rdquo;.</p>
                                ) : (
                                    visible.map((repo) => (
                                        <label key={repo.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                                            <input
                                                type="checkbox"
                                                checked={selectedRepoIds.includes(repo.id)}
                                                onChange={() => toggleRepoId(repo.id)}
                                            />
                                            <span className="text-sm">{repo.displayName ?? repo.externalId}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">{repo.externalCodeHostType}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })()}

                {scope === AgentScope.CONNECTION && (() => {
                    const lc = connectionFilter.toLowerCase();
                    const visible = connections.filter((c) =>
                        c.name.toLowerCase().includes(lc)
                    );
                    const hiddenSelected = selectedConnectionIds.filter(
                        (id) => !visible.some((c) => c.id === id)
                    ).length;
                    return (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Connections</Label>
                                {selectedConnectionIds.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        {selectedConnectionIds.length} selected
                                        {hiddenSelected > 0 && ` (${hiddenSelected} not shown)`}
                                    </span>
                                )}
                            </div>
                            {connections.length > 0 && (
                                <Input
                                    placeholder="Filter connections…"
                                    value={connectionFilter}
                                    onChange={(e) => setConnectionFilter(e.target.value)}
                                />
                            )}
                            <div className="border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
                                {connections.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">No connections found.</p>
                                ) : visible.length === 0 ? (
                                    <p className="p-3 text-sm text-muted-foreground">No connections match &ldquo;{connectionFilter}&rdquo;.</p>
                                ) : (
                                    visible.map((conn) => (
                                        <label key={conn.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                                            <input
                                                type="checkbox"
                                                checked={selectedConnectionIds.includes(conn.id)}
                                                onChange={() => toggleConnectionId(conn.id)}
                                            />
                                            <span className="text-sm">{conn.name}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">{conn.connectionType}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })()}
            </section>

            {/* Prompt */}
            <section className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Custom prompt</h2>
                <p className="text-sm text-muted-foreground">
                    Add custom instructions for the agent. Leave blank to use the built-in defaults only.
                </p>

                <div className="space-y-2">
                    <Label htmlFor="prompt">Instructions</Label>
                    <Textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={`e.g. Flag any use of eval() or innerHTML. Pay special attention to SQL queries built from user input.`}
                        rows={6}
                        className="font-mono text-sm resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                        Supported template variables: <code>{"{{repo_name}}"}</code>
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Prompt mode</Label>
                    <Select value={promptMode} onValueChange={(v) => setPromptMode(v as PromptMode)}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={PromptMode.APPEND}>Append (recommended)</SelectItem>
                            <SelectItem value={PromptMode.REPLACE}>Replace built-in rules</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        <strong>Append</strong> adds your instructions after the built-in rules.{" "}
                        <strong>Replace</strong> discards all built-in rules and uses only your instructions.
                    </p>
                </div>
            </section>

            {/* Settings overrides */}
            <section className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Settings overrides</h2>
                <p className="text-sm text-muted-foreground">
                    Override global environment variable defaults for this config. Leave blank to inherit the global setting.
                </p>

                <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                        value={model}
                        onValueChange={(v) => setModel(v === "__inherit__" ? "" : v)}
                        disabled={isLoadingModels}
                    >
                        <SelectTrigger className="w-72">
                            <SelectValue placeholder={isLoadingModels ? "Loading models…" : "Inherit global setting"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__inherit__">Inherit global setting</SelectItem>
                            {configuredModels.map((m) => (
                                <SelectItem key={m.displayName} value={m.displayName}>
                                    {m.displayName}
                                    <span className="ml-2 text-xs text-muted-foreground">{m.provider}</span>
                                </SelectItem>
                            ))}
                            {!isLoadingModels && configuredModels.length === 0 && (
                                <SelectItem value="__none__" disabled>
                                    No models configured
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Overrides the <code>REVIEW_AGENT_MODEL</code> env var for this config.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="reviewCommand">Review command</Label>
                    <Input
                        id="reviewCommand"
                        value={reviewCommand}
                        onChange={(e) => setReviewCommand(e.target.value)}
                        placeholder="e.g. review (inherits REVIEW_AGENT_REVIEW_COMMAND)"
                    />
                    <p className="text-xs text-muted-foreground">Comment trigger without the leading /</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="contextFiles">Context files</Label>
                    <Input
                        id="contextFiles"
                        value={contextFiles}
                        onChange={(e) => setContextFiles(e.target.value)}
                        placeholder="e.g. AGENTS.md .sourcebot/review.md"
                    />
                    <p className="text-xs text-muted-foreground">
                        Comma- or space-separated paths to files in the repository that provide review guidance (e.g. coding conventions).
                        Fetched once per PR and injected as context. Missing files are silently ignored.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Auto-review</Label>
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="radio"
                                name="autoReview"
                                checked={autoReviewEnabled === undefined}
                                onChange={() => setAutoReviewEnabled(undefined)}
                            />
                            Inherit global setting
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="radio"
                                name="autoReview"
                                checked={autoReviewEnabled === true}
                                onChange={() => setAutoReviewEnabled(true)}
                            />
                            Enabled
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="radio"
                                name="autoReview"
                                checked={autoReviewEnabled === false}
                                onChange={() => setAutoReviewEnabled(false)}
                            />
                            Disabled
                        </label>
                    </div>
                </div>
            </section>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                    {isEditing && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            disabled={isDeleting || isPending}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {isDeleting ? "Deleting…" : "Delete config"}
                        </Button>
                    )}
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => router.push("/agents")}
                        disabled={isPending || isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!name.trim() || isPending || isDeleting}
                    >
                        {isPending ? "Saving…" : isEditing ? "Save changes" : "Create config"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
