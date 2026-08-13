import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileMatch } from './fileMatch';

vi.mock('next/link', () => ({
    default: ({ children, href, prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
        <a {...props} href="#test-target" data-href={href} data-prefetch={String(prefetch)}>
            {children}
        </a>
    ),
}));

vi.mock('@/app/(app)/components/lightweightCodeHighlighter', () => ({
    LightweightCodeHighlighter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const file = {
    fileName: {
        text: 'src/index.ts',
        matchRanges: [],
    },
    webUrl: '',
    repository: 'github.com/sourcebot-dev/sourcebot',
    repositoryId: 1,
    language: 'TypeScript',
    branches: ['main'],
    chunks: [],
};

const match = {
    content: 'const result = true;',
    contentStart: {
        byteOffset: 0,
        lineNumber: 10,
        column: 1,
    },
    matchRanges: [{
        start: {
            byteOffset: 6,
            lineNumber: 10,
            column: 7,
        },
        end: {
            byteOffset: 12,
            lineNumber: 10,
            column: 13,
        },
    }],
};

afterEach(() => {
    cleanup();
});

describe('FileMatch', () => {
    it('disables prefetching and preserves ordinary link clicks', () => {
        const onOpenPreview = vi.fn();
        render(<FileMatch file={file} match={match} onOpenPreview={onOpenPreview} />);

        const link = screen.getByRole('link');
        expect(link.getAttribute('data-prefetch')).toBe('false');

        fireEvent.click(link);
        expect(onOpenPreview).not.toHaveBeenCalled();
    });

    it.each([
        ['Cmd', { metaKey: true }],
        ['Ctrl', { ctrlKey: true }],
    ])('opens the preview and cancels navigation for %s-click', (_modifier, eventInit) => {
        const onOpenPreview = vi.fn();
        render(<FileMatch file={file} match={match} onOpenPreview={onOpenPreview} />);

        const link = screen.getByRole('link');
        const clickEvent = createEvent.click(link, eventInit);
        fireEvent(link, clickEvent);

        expect(clickEvent.defaultPrevented).toBe(true);
        expect(onOpenPreview).toHaveBeenCalledOnce();
    });

    it('supports modifier-plus-Enter for keyboard users', () => {
        const onOpenPreview = vi.fn();
        render(<FileMatch file={file} match={match} onOpenPreview={onOpenPreview} />);

        const link = screen.getByRole('link');
        const keyDownEvent = createEvent.keyDown(link, { key: 'Enter', metaKey: true });
        fireEvent(link, keyDownEvent);

        expect(keyDownEvent.defaultPrevented).toBe(true);
        expect(onOpenPreview).toHaveBeenCalledOnce();
    });
});
