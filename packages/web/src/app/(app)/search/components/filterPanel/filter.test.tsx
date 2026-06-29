import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Filter } from './filter';
import type { Entry } from './entry';

afterEach(() => {
    cleanup();
});

const entries: Entry[] = [
    {
        key: 'powershell',
        displayName: 'PowerShell',
        count: 4,
        isSelected: true,
        isHidden: false,
        isDisabled: false,
    },
    {
        key: 'c',
        displayName: 'C',
        count: 9,
        isSelected: false,
        isHidden: false,
        isDisabled: false,
    },
    {
        key: 'go',
        displayName: 'Go',
        count: 12,
        isSelected: false,
        isHidden: false,
        isDisabled: false,
    },
];

describe('Filter', () => {
    test('renders entries as accessible toggle buttons', () => {
        const onEntryClicked = vi.fn();

        render(
            <TooltipProvider>
                <Filter
                    title="Languages"
                    searchPlaceholder="Search languages"
                    entries={entries}
                    onEntryClicked={onEntryClicked}
                    isStreaming={false}
                />
            </TooltipProvider>,
        );

        const selectedEntry = screen.getByRole('button', { name: /PowerShell/ });
        const unselectedEntry = screen.getByRole('button', { name: /C/ });

        expect(selectedEntry.getAttribute('aria-pressed')).toBe('true');
        expect(unselectedEntry.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(selectedEntry);

        expect(onEntryClicked).toHaveBeenCalledWith('powershell');
    });

    test('keeps selected entries visible and pinned while filtering', () => {
        render(
            <TooltipProvider>
                <Filter
                    title="Languages"
                    searchPlaceholder="Search languages"
                    entries={entries}
                    onEntryClicked={() => undefined}
                    isStreaming={false}
                />
            </TooltipProvider>,
        );

        fireEvent.change(screen.getByPlaceholderText('Search languages'), {
            target: { value: 'C' },
        });

        const selectedEntry = screen.getByText('PowerShell');
        const matchedEntry = screen.getByText('C');

        expect(selectedEntry).toBeTruthy();
        expect(matchedEntry).toBeTruthy();
        expect(screen.queryByText('Go')).toBeNull();
        expect(
            selectedEntry.compareDocumentPosition(matchedEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });
});
