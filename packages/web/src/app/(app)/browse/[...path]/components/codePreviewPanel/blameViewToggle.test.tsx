import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BlameViewToggle } from './blameViewToggle';

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mocks.push,
    }),
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('BlameViewToggle', () => {
    test('preserves source view when entering blame mode', () => {
        render(
            <BlameViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                blame={false}
                viewMode="source"
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: 'View blame' }));

        expect(mocks.push).toHaveBeenCalledWith(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?blame=true&view=source'
        );
    });

    test('preserves source view when leaving blame mode', () => {
        render(
            <BlameViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                blame
                viewMode="source"
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: 'View source code' }));

        expect(mocks.push).toHaveBeenCalledWith(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?view=source'
        );
    });

    test('does not add a view query when rendered preview mode enters blame', () => {
        render(
            <BlameViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                blame={false}
                viewMode="rendered"
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: 'View blame' }));

        expect(mocks.push).toHaveBeenCalledWith(
            '/browse/github.com/sourcebot-dev/sourcebot@main/-/blob/README.md?blame=true'
        );
    });

    test('supports markdown-specific non-blame labels', () => {
        render(
            <BlameViewToggle
                repoName="github.com/sourcebot-dev/sourcebot"
                revisionName="main"
                path="README.md"
                blame={false}
                viewMode="rendered"
                codeLabel="Preview"
                codeAriaLabel="Preview rendered markdown"
            />
        );

        expect(screen.getByRole('radio', { name: 'Preview rendered markdown' }).textContent).toBe('Preview');
    });
});
