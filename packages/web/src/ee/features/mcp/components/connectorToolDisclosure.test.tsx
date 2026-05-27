import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Collapsible } from '@/components/ui/collapsible';
import { ConnectorToolList, ConnectorToolTrigger } from './connectorToolDisclosure';
import type { ServerToolsEntry } from '@/ee/features/mcp/types';

afterEach(() => {
    cleanup();
});

function renderToolTrigger(props: React.ComponentProps<typeof ConnectorToolTrigger>) {
    return render(
        <Collapsible open={props.isOpen}>
            <ConnectorToolTrigger {...props} />
        </Collapsible>,
    );
}

function availableEntry(overrides: Partial<Extract<ServerToolsEntry, { status: 'available' }>> = {}): Extract<ServerToolsEntry, { status: 'available' }> {
    return {
        status: 'available',
        serverId: 'server-1',
        tools: [
            { name: 'search', title: 'Search', description: 'Search issues', annotations: { readOnlyHint: true } },
            { name: 'delete_issue', description: 'Delete an issue', annotations: { destructiveHint: true, idempotentHint: true } },
        ],
        ...overrides,
    };
}

describe('ConnectorToolTrigger', () => {
    test('renders an expandable count for available tools', () => {
        renderToolTrigger({
            isConnected: true,
            toolEntry: availableEntry(),
            isOpen: false,
        });

        expect(screen.getByRole('button', { name: /2 tools/ })).toBeTruthy();
    });

    test('uses plus count language only for list truncation', () => {
        renderToolTrigger({
            isConnected: true,
            toolEntry: availableEntry({ tools: [{ name: 'search' }], truncated: true }),
        });

        expect(screen.getByRole('button', { name: /1\+ tools/ })).toBeTruthy();
    });

    test('renders unavailable state before connection-specific states', () => {
        renderToolTrigger({
            isConnected: false,
            isOAuthAvailable: false,
        });

        expect(screen.getByText('Tools unavailable')).toBeTruthy();
        expect(screen.queryByText('Connect to see tools')).toBeNull();
    });

    test('renders actionable labels for disconnected and expired auth states', () => {
        const { rerender } = render(
            <Collapsible>
                <ConnectorToolTrigger isConnected={false} />
            </Collapsible>,
        );

        expect(screen.getByText('Connect to see tools')).toBeTruthy();

        rerender(
            <Collapsible>
                <ConnectorToolTrigger isConnected={false} isAuthExpired={true} />
            </Collapsible>,
        );

        expect(screen.getByText('Reconnect to see tools')).toBeTruthy();
    });

    test('renders loading and retryable error states for connected servers', () => {
        const onRetry = vi.fn();
        const { rerender } = render(
            <Collapsible>
                <ConnectorToolTrigger isConnected={true} isLoading={true} />
            </Collapsible>,
        );

        expect(screen.getByText('Loading tools...')).toBeTruthy();

        rerender(
            <Collapsible>
                <ConnectorToolTrigger
                    isConnected={true}
                    toolEntry={{ status: 'error', serverId: 'server-1', reason: 'timeout' }}
                    onRetry={onRetry}
                />
            </Collapsible>,
        );

        expect(screen.getByText('Tools timed out')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('maps auth_failed errors to reconnect language', () => {
        renderToolTrigger({
            isConnected: true,
            toolEntry: { status: 'error', serverId: 'server-1', reason: 'auth_failed' },
        });

        expect(screen.getByText('Reconnect to see tools')).toBeTruthy();
    });
});

describe('ConnectorToolList', () => {
    test('renders compact tool badges and expands detail on click', () => {
        render(
            <Collapsible open={true}>
                <ConnectorToolList toolEntry={availableEntry()} />
            </Collapsible>,
        );

        // Both tool badges are visible
        expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'delete_issue' })).toBeTruthy();

        // No detail shown yet
        expect(screen.queryByText('Search issues')).toBeNull();
        expect(screen.queryByText('Read-only')).toBeNull();

        // Click to expand detail
        fireEvent.click(screen.getByRole('button', { name: 'Search' }));
        expect(screen.getByText('Search issues')).toBeTruthy();
        expect(screen.getByText('search')).toBeTruthy();
        expect(screen.getByText('Read-only')).toBeTruthy();

        // Click another tool — previous detail closes, new one opens
        fireEvent.click(screen.getByRole('button', { name: 'delete_issue' }));
        expect(screen.queryByText('Search issues')).toBeNull();
        expect(screen.getByText('Delete an issue')).toBeTruthy();
        expect(screen.getByText('Destructive')).toBeTruthy();
        expect(screen.getByText('Idempotent')).toBeTruthy();

        // Click same tool again to collapse
        fireEvent.click(screen.getByRole('button', { name: 'delete_issue' }));
        expect(screen.queryByText('Delete an issue')).toBeNull();
    });

    test('renders an empty-tools message for available servers with no tools', () => {
        render(
            <Collapsible open={true}>
                <ConnectorToolList toolEntry={availableEntry({ tools: [] })} />
            </Collapsible>,
        );

        expect(screen.getByText('No tools exposed by this connector.')).toBeTruthy();
    });

    test('does not render list content for non-available entries', () => {
        render(
            <Collapsible open={true}>
                <ConnectorToolList toolEntry={{ status: 'error', serverId: 'server-1', reason: 'unknown' }} />
            </Collapsible>,
        );

        expect(screen.queryByText('No tools exposed by this connector.')).toBeNull();
    });
});
