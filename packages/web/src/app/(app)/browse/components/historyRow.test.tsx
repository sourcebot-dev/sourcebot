import { cleanup, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HistoryRow } from './historyRow';

const mocks = vi.hoisted(() => ({
    pathname: '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md',
    search: '',
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mocks.pathname,
    useSearchParams: () => new URLSearchParams(mocks.search),
}));

afterEach(() => {
    cleanup();
});

const renderWithTooltipProvider = (ui: React.ReactNode) => render(
    <TooltipProvider>{ui}</TooltipProvider>
);

const commit = {
    hash: 'abc123456789',
    date: '2026-01-02T03:04:05.000Z',
    message: 'Update README',
    refs: '',
    body: '',
    authorName: 'Sourcebot Maintainer',
    authorEmail: 'maintainer@sourcebot.dev',
    parents: ['parent123'],
};

describe('HistoryRow', () => {
    beforeEach(() => {
        mocks.pathname = '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md';
        mocks.search = '';
    });

    test('preserves source view in file history preview links', () => {
        mocks.search = 'view=source';

        renderWithTooltipProvider(
            <HistoryRow
                commit={commit}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                pathType="blob"
            />
        );

        expect(screen.getByRole('link', { name: 'View code at this commit' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789&view=source'
        );
    });

    test('preserves source view in focused diff links', () => {
        mocks.search = 'view=source';

        renderWithTooltipProvider(
            <HistoryRow
                commit={commit}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                pathType="blob"
            />
        );

        expect(screen.getByRole('link', { name: 'Update README' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789&diff=true&view=source'
        );
    });

    test('preserves source view in history links when a highlight range forced source mode', () => {
        mocks.search = 'highlightRange=12,12';

        renderWithTooltipProvider(
            <HistoryRow
                commit={commit}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                pathType="blob"
            />
        );

        expect(screen.getByRole('link', { name: 'View code at this commit' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789&view=source'
        );
        expect(screen.getByRole('link', { name: 'Update README' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789&diff=true&view=source'
        );
    });

    test('keeps rendered preview history links as the default URL', () => {
        renderWithTooltipProvider(
            <HistoryRow
                commit={commit}
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                pathType="blob"
            />
        );

        expect(screen.getByRole('link', { name: 'View code at this commit' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789'
        );
        expect(screen.getByRole('link', { name: 'Update README' }).getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?ref=abc123456789&diff=true'
        );
    });
});
