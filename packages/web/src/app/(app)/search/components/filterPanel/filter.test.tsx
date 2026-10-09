import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Filter } from './filter';
import type { Entry } from './entry';

afterEach(cleanup);

const createEntry = (displayName: string, isSelected = false, count = 1): Entry => ({
    key: displayName,
    displayName,
    count,
    isSelected,
    isHidden: false,
    isDisabled: false,
});

const renderFilter = (entries: Entry[], onEntryClicked = vi.fn()) => render(
    <TooltipProvider>
        <Filter
            title="Languages"
            searchPlaceholder="Filter languages"
            entries={entries}
            onEntryClicked={onEntryClicked}
            isStreaming={false}
        />
    </TooltipProvider>,
);

describe('search filters', () => {
    it('keeps selected languages above matches and allows clearing a hidden-by-search selection', () => {
        const onEntryClicked = vi.fn();
        renderFilter([
            createEntry('C', false, 100),
            createEntry('PowerShell', true),
            createEntry('Python'),
        ], onEntryClicked);

        fireEvent.change(screen.getByPlaceholderText('Filter languages'), { target: { value: 'C' } });

        const selected = screen.getByText('PowerShell');
        const match = screen.getByText('C');
        expect(selected.compareDocumentPosition(match) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByText('Python')).toBeNull();

        fireEvent.click(selected);
        expect(onEntryClicked).toHaveBeenCalledExactlyOnceWith('PowerShell');
    });

    it('shows a selected entry once when it also matches the filter', () => {
        renderFilter([createEntry('Python', true), createEntry('PowerShell')]);

        fireEvent.change(screen.getByPlaceholderText('Filter languages'), { target: { value: 'Python' } });

        expect(screen.getAllByText('Python')).toHaveLength(1);
        expect(screen.queryByText('PowerShell')).toBeNull();
    });

    it('preserves selected entries when the filter has no matches', () => {
        renderFilter([createEntry('PowerShell', true), createEntry('Python')]);

        fireEvent.change(screen.getByPlaceholderText('Filter languages'), { target: { value: 'zzzz' } });

        expect(screen.getByText('PowerShell')).toBeTruthy();
        expect(screen.queryByText('Python')).toBeNull();
    });

    it('does not reorder the caller\'s entries when sorting the unfiltered list', () => {
        const entries = [createEntry('Python'), createEntry('PowerShell', true)];
        Object.freeze(entries);

        renderFilter(entries);

        expect(entries.map(entry => entry.key)).toEqual(['Python', 'PowerShell']);
        expect(screen.getByText('PowerShell')).toBeTruthy();
    });
});
