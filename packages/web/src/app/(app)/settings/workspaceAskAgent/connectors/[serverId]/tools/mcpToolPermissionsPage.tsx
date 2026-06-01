'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getMcpServerToolPermissions } from '@/app/api/(client)/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/hooks/use-toast';
import { updateMcpServerToolPermissions } from '@/ee/features/chat/mcp/actions';
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from '@/ee/features/chat/mcp/queryKeys';
import type {
    McpServerToolPermission,
    McpServerToolPermissionEntry,
} from '@/ee/features/chat/mcp/types';
import { formatCount, pluralize } from '@/features/chat/mcp/utils';
import { cn, isServiceError } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeftIcon,
    BanIcon,
    CircleCheckIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    HandIcon,
    Loader2Icon,
    RefreshCwIcon,
    SearchIcon,
    SlidersHorizontalIcon,
} from 'lucide-react';

const PERMISSION_OPTIONS: Array<{
    value: McpServerToolPermission;
    label: string;
    icon: typeof CircleCheckIcon;
    selectedClassName: string;
}> = [
    { value: 'ALLOWED', label: 'Allowed', icon: CircleCheckIcon, selectedClassName: '!border-green-600 !bg-green-600 !text-white !opacity-100 shadow-sm ring-2 ring-green-600/30' },
    { value: 'NEEDS_APPROVAL', label: 'Needs approval', icon: HandIcon, selectedClassName: '!border-primary !bg-primary !text-primary-foreground !opacity-100 shadow-sm ring-2 ring-primary/30' },
    { value: 'DISABLED', label: 'Disabled', icon: BanIcon, selectedClassName: '!border-destructive !bg-destructive !text-destructive-foreground !opacity-100 shadow-sm ring-2 ring-destructive/30' },
];

const EMPTY_TOOLS: McpServerToolPermissionEntry[] = [];

type PermissionFilter = 'ALL' | McpServerToolPermission;

interface McpToolPermissionsPageProps {
    serverId: string;
}

interface ToolGroup {
    id: 'read-only' | 'write-delete';
    label: string;
    tools: McpServerToolPermissionEntry[];
}

function getToolDisplayName(tool: McpServerToolPermissionEntry) {
    return tool.title ?? tool.toolName;
}

function getGroupPermissionLabel(permission: McpServerToolPermission) {
    switch (permission) {
        case 'ALLOWED':
            return 'Allowed';
        case 'NEEDS_APPROVAL':
            return 'Needs Approval';
        case 'DISABLED':
            return 'Blocked';
    }
}

function getPermissionIconClassName(permission: McpServerToolPermission) {
    switch (permission) {
        case 'ALLOWED':
            return 'text-green-500';
        case 'NEEDS_APPROVAL':
            return 'text-primary';
        case 'DISABLED':
            return 'text-destructive';
    }
}

function getGroupPermissionOption(permission: McpServerToolPermission) {
    return PERMISSION_OPTIONS.find((option) => option.value === permission) ?? PERMISSION_OPTIONS[0];
}

function getEffectiveToolPermission(
    tool: McpServerToolPermissionEntry,
    permissionsByToolName: Record<string, McpServerToolPermission>,
) {
    return permissionsByToolName[tool.toolName] ?? tool.permission;
}

function getVisiblePermissionSummary(
    tools: McpServerToolPermissionEntry[],
    permissionsByToolName: Record<string, McpServerToolPermission>,
) {
    const firstTool = tools[0];
    if (firstTool) {
        const firstPermission = getEffectiveToolPermission(firstTool, permissionsByToolName);
        const isSamePermission = tools.every((tool) => (
            getEffectiveToolPermission(tool, permissionsByToolName) === firstPermission
        ));

        if (isSamePermission) {
            return {
                label: getGroupPermissionLabel(firstPermission),
                icon: getGroupPermissionOption(firstPermission).icon,
            };
        }
    }

    return { label: 'Custom', icon: SlidersHorizontalIcon };
}

function ToolHintBadges({ tool }: { tool: McpServerToolPermissionEntry }) {
    const annotations = tool.annotations;
    if (!annotations) {
        return null;
    }

    return (
        <>
            {annotations.readOnlyHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                    Read-only
                </Badge>
            )}
            {annotations.destructiveHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-destructive">
                    Destructive
                </Badge>
            )}
            {annotations.idempotentHint === true && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                    Idempotent
                </Badge>
            )}
        </>
    );
}

function PermissionCount({
    permission,
    count,
}: {
    permission: McpServerToolPermission;
    count: number;
}) {
    const option = getGroupPermissionOption(permission);
    const Icon = option.icon;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1">
                    <Icon className={cn("h-3.5 w-3.5", getPermissionIconClassName(permission))} />
                    {formatCount(count)}
                </span>
            </TooltipTrigger>
            <TooltipContent>{getGroupPermissionLabel(permission)}</TooltipContent>
        </Tooltip>
    );
}

function PermissionToggleGroup({
    toolName,
    value,
    onChange,
}: {
    toolName: string;
    value: McpServerToolPermission;
    onChange: (permission: McpServerToolPermission) => void;
}) {
    return (
        <ToggleGroup
            type="single"
            value={value}
            onValueChange={(nextValue) => {
                if (nextValue) {
                    onChange(nextValue as McpServerToolPermission);
                }
            }}
            className="justify-end"
        >
            {PERMISSION_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = value === option.value;

                return (
                    <Tooltip key={option.value}>
                        <TooltipTrigger asChild>
                            <ToggleGroupItem
                                value={option.value}
                                aria-label={`${option.label} for ${toolName}`}
                                className={cn(
                                    "h-8 w-8 border bg-transparent text-muted-foreground opacity-55 transition-all hover:opacity-100",
                                    isSelected && `opacity-100 ${option.selectedClassName}`,
                                )}
                            >
                                <Icon className="h-4 w-4" />
                            </ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent>{option.label}</TooltipContent>
                    </Tooltip>
                );
            })}
        </ToggleGroup>
    );
}

function ToolRow({
    tool,
    permission,
    onPermissionChange,
}: {
    tool: McpServerToolPermissionEntry;
    permission: McpServerToolPermission;
    onPermissionChange: (permission: McpServerToolPermission) => void;
}) {
    const displayName = getToolDisplayName(tool);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const hasDescription = Boolean(tool.description);

    return (
        <div className="grid gap-3 border-b px-3 py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-start gap-1.5">
                {hasDescription ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                                aria-label={`${isDescriptionOpen ? 'Hide' : 'Show'} description for ${displayName}`}
                                aria-expanded={isDescriptionOpen}
                                onClick={() => setIsDescriptionOpen((current) => !current)}
                            >
                                {isDescriptionOpen
                                    ? <ChevronDownIcon className="h-3.5 w-3.5" />
                                    : <ChevronRightIcon className="h-3.5 w-3.5" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isDescriptionOpen ? 'Hide description' : 'Show description'}</TooltipContent>
                    </Tooltip>
                ) : (
                    <div className="h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="break-all text-sm font-medium text-foreground">{displayName}</span>
                        {tool.title && tool.title !== tool.toolName && (
                            <span className="break-all font-mono text-[11px] text-muted-foreground">{tool.toolName}</span>
                        )}
                        <ToolHintBadges tool={tool} />
                    </div>
                    {hasDescription && isDescriptionOpen && (
                        <p className="break-words text-xs text-muted-foreground">{tool.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {formatCount(tool.callCount)} {pluralize(tool.callCount, 'call')}
                        {!tool.discovered && <span> - not in latest discovery</span>}
                    </p>
                </div>
            </div>
            <div className="flex items-center justify-end">
                <PermissionToggleGroup
                    toolName={tool.toolName}
                    value={permission}
                    onChange={onPermissionChange}
                />
            </div>
        </div>
    );
}

export function McpToolPermissionsPage({ serverId }: McpToolPermissionsPageProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState('');
    const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('ALL');
    const [openGroups, setOpenGroups] = useState<Record<ToolGroup['id'], boolean>>({
        'read-only': true,
        'write-delete': true,
    });
    const [permissionsByToolName, setPermissionsByToolName] = useState<Record<string, McpServerToolPermission>>({});
    const [isSaving, setIsSaving] = useState(false);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: mcpQueryKeys.toolPermissions(serverId),
        queryFn: async () => {
            const result = await getMcpServerToolPermissions(serverId);
            if (isServiceError(result)) {
                throw new Error(result.message);
            }
            return result;
        },
    });

    useEffect(() => {
        if (!data) {
            return;
        }

        setPermissionsByToolName(Object.fromEntries(
            data.tools.map((tool) => [tool.toolName, tool.permission]),
        ));
    }, [data]);

    const tools = data?.tools ?? EMPTY_TOOLS;
    const permissionCounts = useMemo(() => {
        const counts: Record<McpServerToolPermission, number> = {
            ALLOWED: 0,
            NEEDS_APPROVAL: 0,
            DISABLED: 0,
        };

        for (const tool of tools) {
            counts[permissionsByToolName[tool.toolName] ?? tool.permission] += 1;
        }

        return counts;
    }, [permissionsByToolName, tools]);

    const filteredTools = useMemo(() => {
        const query = searchInput.trim().toLowerCase();

        return tools.filter((tool) => {
            const permission = permissionsByToolName[tool.toolName] ?? tool.permission;
            if (permissionFilter !== 'ALL' && permission !== permissionFilter) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                tool.toolName,
                tool.title,
                tool.description,
            ].some((value) => value?.toLowerCase().includes(query));
        });
    }, [permissionFilter, permissionsByToolName, searchInput, tools]);
    const filteredToolGroups = useMemo<ToolGroup[]>(() => [
        {
            id: 'read-only',
            label: 'Read-only tools',
            tools: filteredTools.filter((tool) => tool.annotations?.readOnlyHint === true),
        },
        {
            id: 'write-delete',
            label: 'Write/delete tools',
            tools: filteredTools.filter((tool) => tool.annotations?.readOnlyHint !== true),
        },
    ].filter((group) => group.tools.length > 0), [filteredTools]);

    const isDirty = useMemo(() => (
        tools.some((tool) => (permissionsByToolName[tool.toolName] ?? tool.permission) !== tool.permission)
    ), [permissionsByToolName, tools]);

    const handlePermissionChange = (toolName: string, permission: McpServerToolPermission) => {
        setPermissionsByToolName((current) => ({
            ...current,
            [toolName]: permission,
        }));
    };

    const handleApplyToTools = (toolsToUpdate: McpServerToolPermissionEntry[], permission: McpServerToolPermission) => {
        setPermissionsByToolName((current) => {
            const next = { ...current };
            for (const tool of toolsToUpdate) {
                next[tool.toolName] = permission;
            }
            return next;
        });
    };

    const handleGroupOpenChange = (groupId: ToolGroup['id']) => {
        setOpenGroups((current) => ({
            ...current,
            [groupId]: !current[groupId],
        }));
    };

    const handleReset = () => {
        if (!data) {
            return;
        }

        setPermissionsByToolName(Object.fromEntries(
            data.tools.map((tool) => [tool.toolName, tool.permission]),
        ));
    };

    const handleSave = async () => {
        if (!data) {
            return;
        }

        const changedTools = data.tools.flatMap((tool) => {
            const permission = permissionsByToolName[tool.toolName] ?? tool.permission;
            return permission === tool.permission
                ? []
                : [{ toolName: tool.toolName, permission }];
        });
        if (changedTools.length === 0) {
            return;
        }

        setIsSaving(true);
        try {
            const result = await updateMcpServerToolPermissions(serverId, changedTools);

            if (isServiceError(result)) {
                toast({ title: 'Error', description: `Failed to update tool permissions: ${result.message}`, variant: 'destructive' });
                return;
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: mcpQueryKeys.toolPermissions(serverId) }),
                invalidateMcpConfigurationQueries(queryClient),
            ]);
            toast({ description: `Tool permissions updated for ${result.updatedToolCount} ${pluralize(result.updatedToolCount, 'tool')}.` });
        } catch {
            toast({ title: 'Error', description: 'Failed to update tool permissions.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-72" />
                    <Skeleton className="h-4 w-96 max-w-full" />
                </div>
                <Separator />
                <Skeleton className="h-9 w-full" />
                <div className="rounded-md border">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-3 border-b p-3 last:border-b-0">
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-72 max-w-full" />
                            </div>
                            <Skeleton className="h-8 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="flex flex-col gap-6">
                <Link href="/settings/workspaceAskAgent" className="inline-flex w-fit items-center gap-1.5 text-sm text-link hover:underline">
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Ask Sourcebot
                </Link>
                <div>
                    <h3 className="text-lg font-medium">Tool permissions</h3>
                    <p className="text-sm text-muted-foreground">Unable to load tool permissions.</p>
                </div>
                <Button variant="outline" className="w-fit" onClick={() => { void refetch(); }}>
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    const metadataStatus = data.metadataStatus;

    return (
        <div className="flex flex-col gap-6">
            <Link href="/settings/workspaceAskAgent" className="inline-flex w-fit items-center gap-1.5 text-sm text-link hover:underline">
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Ask Sourcebot
            </Link>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                        {data.server.faviconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={data.server.faviconUrl} alt="" className="h-5 w-5 shrink-0 rounded-sm" />
                        )}
                        <h3 className="truncate text-lg font-medium">{data.server.name}</h3>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{data.server.serverUrl}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatCount(tools.length)} {pluralize(tools.length, 'tool')}</span>
                        <PermissionCount permission="ALLOWED" count={permissionCounts.ALLOWED} />
                        <PermissionCount permission="NEEDS_APPROVAL" count={permissionCounts.NEEDS_APPROVAL} />
                        <PermissionCount permission="DISABLED" count={permissionCounts.DISABLED} />
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" onClick={handleReset} disabled={!isDirty || isSaving}>
                        Reset
                    </Button>
                    <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                        {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                        Apply
                    </Button>
                </div>
            </div>

            <Separator />

            {metadataStatus.status !== 'available' && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                    {metadataStatus.status === 'not_connected'
                        ? "Connect as an admin to refresh this connector's tool list."
                        : 'The latest tool list could not be refreshed.'}
                </div>
            )}

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="relative md:w-80">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search tools"
                        className="pl-8"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Select value={permissionFilter} onValueChange={(value) => setPermissionFilter(value as PermissionFilter)}>
                        <SelectTrigger className="h-9 w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All permissions</SelectItem>
                            {PERMISSION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-4">
                {filteredTools.length === 0 ? (
                    <div className="rounded-md border px-3 py-10 text-center text-sm text-muted-foreground">
                        {tools.length === 0 ? 'No tools discovered yet.' : 'No matching tools.'}
                    </div>
                ) : (
                    filteredToolGroups.map((group) => {
                        const permissionSummary = getVisiblePermissionSummary(group.tools, permissionsByToolName);
                        const PermissionSummaryIcon = permissionSummary.icon;

                        return (
                            <section key={group.id} className="rounded-md border">
                                <div
                                    className={cn(
                                        "flex items-center gap-2 bg-muted/30 transition-colors",
                                        openGroups[group.id] && "border-b",
                                    )}
                                >
                                    <button
                                        type="button"
                                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                                        aria-expanded={openGroups[group.id]}
                                        onClick={() => handleGroupOpenChange(group.id)}
                                    >
                                        {openGroups[group.id]
                                            ? <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            : <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                        <h4 className="truncate text-sm font-medium text-foreground">{group.label}</h4>
                                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                                            {formatCount(group.tools.length)}
                                        </Badge>
                                    </button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="mr-2 h-8 shrink-0 px-2 text-xs"
                                                aria-label={`Change permissions for visible ${group.label}`}
                                            >
                                                <PermissionSummaryIcon className="mr-1 h-3.5 w-3.5" />
                                                {permissionSummary.label}
                                                <ChevronDownIcon className="ml-1 h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {PERMISSION_OPTIONS.map((option) => {
                                                const Icon = option.icon;

                                                return (
                                                    <DropdownMenuItem key={option.value} onClick={() => handleApplyToTools(group.tools, option.value)}>
                                                        <Icon className="mr-2 h-4 w-4" />
                                                        {getGroupPermissionLabel(option.value)}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                {openGroups[group.id] && group.tools.map((tool) => (
                                        <ToolRow
                                            key={tool.toolName}
                                            tool={tool}
                                            permission={permissionsByToolName[tool.toolName] ?? tool.permission}
                                            onPermissionChange={(permission) => handlePermissionChange(tool.toolName, permission)}
                                        />
                                    ))}
                            </section>
                        );
                    })
                )}
            </div>
        </div>
    );
}
