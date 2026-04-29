'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/userAvatar";
import { cn } from "@/lib/utils";
import type { CommitAuthor } from "@/features/git";

interface AuthorFilterProps {
    authors: CommitAuthor[];
    selectedAuthor?: string;
}

export const AuthorFilter = ({ authors, selectedAuthor }: AuthorFilterProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Reset the search input when the popover (re)opens, so stale text from a
    // prior session doesn't appear. Intentionally does NOT fire on close —
    // mid-close re-renders race with Radix's close animation and cause the
    // flash-open-then-close behavior.
    useEffect(() => {
        if (isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    const selectedAuthorDisplay = useMemo(() => {
        if (!selectedAuthor) {
            return undefined;
        }
        const key = selectedAuthor.toLowerCase();
        return authors.find((a) => a.email.toLowerCase() === key);
    }, [authors, selectedAuthor]);

    const filteredAuthors = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (term.length === 0) {
            return authors;
        }
        return authors.filter(
            (a) =>
                a.name.toLowerCase().includes(term) ||
                a.email.toLowerCase().includes(term),
        );
    }, [authors, search]);

    const navigateWithAuthor = useCallback((author: string | null) => {
        const params = new URLSearchParams(searchParams);
        if (author === null) {
            params.delete('author');
        } else {
            params.set('author', author);
        }
        params.delete('page');
        const query = params.toString();
        // Close the popover before kicking off navigation so the close render
        // commits cleanly; the search reset is deferred to the next open.
        setIsOpen(false);
        router.push(`${pathname}${query ? `?${query}` : ''}`);
    }, [pathname, router, searchParams]);

    const buttonLabel = selectedAuthor
        ? selectedAuthorDisplay?.name ?? selectedAuthor
        : 'All users';

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 flex-shrink-0"
                    aria-label="Filter by author"
                >
                    {selectedAuthorDisplay ? (
                        <UserAvatar
                            email={selectedAuthorDisplay.email}
                            className="h-5 w-5 flex-shrink-0"
                        />
                    ) : (
                        <Users className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate max-w-[160px]">{buttonLabel}</span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Find a user..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {search.trim().length > 0 && (
                            <CommandItem
                                value={`__filter_${search}`}
                                onSelect={() => navigateWithAuthor(search.trim())}
                                className="cursor-pointer"
                            >
                                <span>
                                    Filter on author <strong>{search.trim()}</strong>
                                </span>
                            </CommandItem>
                        )}
                        {filteredAuthors.map((a) => {
                            const isSelected =
                                !!selectedAuthor &&
                                a.email.toLowerCase() === selectedAuthor.toLowerCase();
                            return (
                                <CommandItem
                                    key={a.email}
                                    value={a.email}
                                    onSelect={() => navigateWithAuthor(a.email)}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "h-4 w-4 flex-shrink-0",
                                            isSelected ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                    <UserAvatar
                                        email={a.email}
                                        className="h-5 w-5 flex-shrink-0"
                                    />
                                    <span className="truncate font-medium">{a.name}</span>
                                </CommandItem>
                            );
                        })}
                    </CommandList>
                    {selectedAuthor && (
                        <>
                            <CommandSeparator />
                            <div className="p-1">
                                <CommandItem
                                    value="__clear"
                                    onSelect={() => navigateWithAuthor(null)}
                                    className="cursor-pointer justify-center text-primary"
                                >
                                    View commits for all users
                                </CommandItem>
                            </div>
                        </>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
};
