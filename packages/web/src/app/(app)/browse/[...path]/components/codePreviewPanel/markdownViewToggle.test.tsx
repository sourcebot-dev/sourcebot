import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { MarkdownViewToggle } from './markdownViewToggle';

afterEach(() => {
    cleanup();
});

describe('MarkdownViewToggle', () => {
    test('marks rendered preview as selected by default', () => {
        render(
            <MarkdownViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                viewMode="rendered"
            />
        );

        const preview = screen.getByRole('radio', { name: 'Preview rendered markdown' });
        const source = screen.getByRole('radio', { name: 'View raw markdown source' });

        expect(preview.textContent).toBe('Preview');
        expect(preview.getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md'
        );
        expect(preview.getAttribute('aria-checked')).toBe('true');

        expect(source.textContent).toBe('Source');
        expect(source.getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?view=source'
        );
        expect(source.getAttribute('aria-checked')).toBe('false');
    });

    test('marks source mode as selected when raw markdown is active', () => {
        render(
            <MarkdownViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                viewMode="source"
            />
        );

        const preview = screen.getByRole('radio', { name: 'Preview rendered markdown' });
        const source = screen.getByRole('radio', { name: 'View raw markdown source' });

        expect(preview.getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md'
        );
        expect(preview.getAttribute('aria-checked')).toBe('false');

        expect(source.getAttribute('href')).toBe(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?view=source'
        );
        expect(source.getAttribute('aria-checked')).toBe('true');
    });
});
