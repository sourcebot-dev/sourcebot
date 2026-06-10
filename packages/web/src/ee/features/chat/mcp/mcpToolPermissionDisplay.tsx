import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { McpServerToolPermission } from '@sourcebot/db';
import { BanIcon, CircleCheckIcon, HandIcon, type LucideIcon } from 'lucide-react';
import type { ToolSummary } from './types';

interface McpServerToolPermissionDisplay {
    label: string;
    icon: LucideIcon;
    iconClassName: string;
    selectedClassName: string;
}

export const MCP_SERVER_TOOL_PERMISSION_DISPLAY = {
    ALLOWED: {
        label: 'Allowed',
        icon: CircleCheckIcon,
        iconClassName: 'text-green-500',
        selectedClassName: '!border-green-600 !bg-green-600 !text-white !opacity-100 shadow-sm ring-2 ring-green-600/30',
    },
    NEEDS_APPROVAL: {
        label: 'Needs Approval',
        icon: HandIcon,
        iconClassName: 'text-primary',
        selectedClassName: '!border-primary !bg-primary !text-primary-foreground !opacity-100 shadow-sm ring-2 ring-primary/30',
    },
    DISABLED: {
        label: 'Blocked',
        icon: BanIcon,
        iconClassName: 'text-destructive',
        selectedClassName: '!border-destructive !bg-destructive !text-destructive-foreground !opacity-100 shadow-sm ring-2 ring-destructive/30',
    },
} satisfies Record<McpServerToolPermission, McpServerToolPermissionDisplay>;

export const MCP_SERVER_TOOL_PERMISSION_OPTIONS: Array<McpServerToolPermissionDisplay & {
    value: McpServerToolPermission;
}> = [
    { value: 'ALLOWED', ...MCP_SERVER_TOOL_PERMISSION_DISPLAY.ALLOWED },
    { value: 'NEEDS_APPROVAL', ...MCP_SERVER_TOOL_PERMISSION_DISPLAY.NEEDS_APPROVAL },
    { value: 'DISABLED', ...MCP_SERVER_TOOL_PERMISSION_DISPLAY.DISABLED },
];

export function getMcpServerToolPermissionDisplay(permission: McpServerToolPermission) {
    return MCP_SERVER_TOOL_PERMISSION_DISPLAY[permission];
}

export function ToolHintBadges({ annotations }: { annotations?: ToolSummary['annotations'] }) {
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

export function ToolPermissionBadge({ permission }: { permission?: McpServerToolPermission }) {
    if (!permission) {
        return null;
    }

    const display = getMcpServerToolPermissionDisplay(permission);
    const Icon = display.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "px-1.5 py-0 text-[10px] font-medium transition-none",
                display.iconClassName,
            )}
        >
            <Icon className="mr-1 h-3 w-3" />
            {display.label}
        </Badge>
    );
}
