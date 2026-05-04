'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DateFilterProps {
    since?: string;
    until?: string;
}

// Parse 'YYYY-MM-DD' as a date in the local calendar (not UTC midnight).
const parseLocalDate = (s: string): Date | undefined => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!match) {
        return undefined;
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatLabel = (from: Date | undefined, to: Date | undefined): string => {
    if (!from && !to) {
        return 'All time';
    }
    const currentYear = new Date().getFullYear();
    const fmt = (d: Date) =>
        d.getFullYear() === currentYear ? format(d, 'MMM d') : format(d, 'MMM d, yyyy');

    if (from && to) {
        if (formatLocalDate(from) === formatLocalDate(to)) {
            return fmt(from);
        }
        return `${fmt(from)} - ${fmt(to)}`;
    }
    return fmt((from ?? to) as Date);
};

export const DateFilter = ({ since, until }: DateFilterProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isOpen, setIsOpen] = useState(false);
    const [timeZone, setTimeZone] = useState<string | undefined>(undefined);

    const fromDate = useMemo(() => (since ? parseLocalDate(since) : undefined), [since]);
    const toDate = useMemo(() => (until ? parseLocalDate(until) : undefined), [until]);

    const [month, setMonth] = useState<Date | undefined>(fromDate);

    useEffect(() => {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);

    const selectedRange: DateRange | undefined = useMemo(() => {
        if (!fromDate && !toDate) {
            return undefined;
        }
        return { from: fromDate, to: toDate };
    }, [fromDate, toDate]);

    // Track in-progress selection locally so DayPicker can distinguish between
    // a first click (`{from, to: undefined}`) and a completed range. Without
    // this, controlling `selected` directly off the URL would make every click
    // look like a fresh range start.
    const [draftRange, setDraftRange] = useState<DateRange | undefined>(selectedRange);

    // Sync the draft with the URL whenever the popover is (re)opened, so a
    // half-finished selection from a previous session doesn't carry over.
    useEffect(() => {
        if (isOpen) {
            setDraftRange(selectedRange);
        }
    }, [isOpen, selectedRange]);

    const navigateWithRange = useCallback(
        (from: Date | undefined, to: Date | undefined) => {
            const params = new URLSearchParams(searchParams);
            if (from) {
                params.set('since', formatLocalDate(from));
            } else {
                params.delete('since');
            }
            if (to) {
                params.set('until', formatLocalDate(to));
            } else {
                params.delete('until');
            }
            params.delete('page');
            const query = params.toString();
            setIsOpen(false);
            router.push(`${pathname}${query ? `?${query}` : ''}`);
        },
        [pathname, router, searchParams],
    );

    const onSelect = useCallback(
        (selected: DateRange | undefined) => {
            const draftWasComplete = Boolean(draftRange?.from && draftRange.to);
            const draftWasPartial = Boolean(draftRange?.from && !draftRange.to);

            // When a complete range already exists, react-day-picker v9 adjusts
            // the existing range based on where the click lands (moving one
            // endpoint), producing a new complete range in a single click. We
            // require two clicks to form a new range, so intercept that case:
            // infer the clicked date and demote to a partial range.
            if (draftWasComplete && selected?.from && selected.to) {
                const prevFromTime = draftRange!.from!.getTime();
                const prevToTime = draftRange!.to!.getTime();
                const fromIsNew =
                    selected.from.getTime() !== prevFromTime &&
                    selected.from.getTime() !== prevToTime;
                const toIsNew =
                    selected.to.getTime() !== prevFromTime &&
                    selected.to.getTime() !== prevToTime;
                // Prefer whichever endpoint is actually new; fall back to
                // `from` if both happen to match (shouldn't happen in practice).
                const clickedDate = fromIsNew
                    ? selected.from
                    : toIsNew
                        ? selected.to
                        : selected.from;
                setDraftRange({ from: clickedDate, to: undefined });
                return;
            }

            // react-day-picker v9 can also return a complete single-day range
            // (`{from: D, to: D}`) on a single click when there was no prior
            // partial selection. Demote that to a partial range too.
            const isSingleDay =
                selected?.from &&
                selected.to &&
                selected.from.getTime() === selected.to.getTime();

            if (isSingleDay && !draftWasPartial) {
                setDraftRange({ from: selected!.from, to: undefined });
                return;
            }

            setDraftRange(selected);
            if (selected?.from && selected.to) {
                navigateWithRange(selected.from, selected.to);
            }
        },
        [draftRange, navigateWithRange],
    );

    const onClear = useCallback(() => {
        navigateWithRange(undefined, undefined);
    }, [navigateWithRange]);

    const onToday = useCallback(() => {
        setMonth(new Date());
    }, []);

    const label = formatLabel(fromDate, toDate);
    const hasFilter = Boolean(fromDate || toDate);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 flex-shrink-0"
                    aria-label="Filter by date"
                >
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate max-w-[180px]">{label}</span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    captionLayout="dropdown"
                    selected={draftRange}
                    onSelect={onSelect}
                    month={month}
                    onMonthChange={setMonth}
                    timeZone={timeZone}
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                />
                <div className="flex flex-row items-center gap-4 px-3 py-2 border-t">
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onClear}
                        disabled={!hasFilter}
                        className="h-auto p-0 text-foreground font-medium"
                    >
                        Clear
                    </Button>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={onToday}
                        className="h-auto p-0"
                    >
                        Today
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};
