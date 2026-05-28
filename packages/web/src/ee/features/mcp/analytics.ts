import { McpServerClientInfoSource } from '@sourcebot/db';
import type { McpConnectorAuthMode, McpConnectorEntryPoint } from '@/lib/posthogEvents';
import { getExternalMcpErrorLogFields } from './externalMcpError';

export function getMcpConnectorEntryPoint(returnTo: string | undefined): McpConnectorEntryPoint {
    if (returnTo?.startsWith('/chat')) {
        return 'chat';
    }
    if (returnTo?.startsWith('/settings/accountAskAgent')) {
        return 'account_settings';
    }
    if (returnTo?.startsWith('/settings/workspaceAskAgent')) {
        return 'workspace_settings';
    }

    return 'unknown';
}

export function getMcpAuthMode(clientInfoSource: McpServerClientInfoSource): McpConnectorAuthMode {
    return clientInfoSource === McpServerClientInfoSource.STATIC ? 'static' : 'dynamic';
}

export function getMcpConnectorFailureReason(error: unknown): string {
    const fields = getExternalMcpErrorLogFields(error);
    if (fields.reason) {
        return fields.reason;
    }
    if (fields.oauthError) {
        return fields.oauthError;
    }
    if (fields.statusCode) {
        return `status_${fields.statusCode}`;
    }
    if (fields.errorClass) {
        return fields.errorClass;
    }

    return 'unknown';
}
