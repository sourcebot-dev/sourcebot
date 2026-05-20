"use client";

import { ChatActionsDropdown } from "@/app/(app)/chat/components/chatActionsDropdown";
import { DeleteChatDialog } from "@/app/(app)/chat/components/deleteChatDialog";
import { DuplicateChatDialog } from "@/app/(app)/chat/components/duplicateChatDialog";
import { RenameChatDialog } from "@/app/(app)/chat/components/renameChatDialog";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteChat, duplicateChat, updateChatName } from "@/features/chat/actions";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { cn, isServiceError } from "@/lib/utils";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, EllipsisIcon, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { listChats } from "@/app/api/(client)/client";
import type { ListChatsResponse } from "@/app/api/(server)/chats/types";

type Chat = ListChatsResponse["chats"][number];
type SortBy = "name" | "updatedAt";
type SortOrder = "asc" | "desc";

interface ColumnsContext {
    sortBy: SortBy;
    sortOrder: SortOrder;
    onSortChange: (column: SortBy) => void;
}

function getColumns(context: ColumnsContext): ColumnDef<Chat>[] {
    return [
        {
            accessorKey: "name",
            header: () => {
                const isActive = context.sortBy === "name";
                const Icon = isActive
                    ? (context.sortOrder === "asc" ? ArrowUp : ArrowDown)
                    : ArrowUpDown;
                return (
                    <Button
                        variant="ghost"
                        onClick={() => context.onSortChange("name")}
                        className="-ml-4"
                    >
                        Name
                        <Icon className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const chat = row.original;
                return (
                    <Link
                        href={`/chat/${chat.id}`}
                        className="flex items-center gap-3 font-medium hover:underline"
                    >
                        <span className="truncate">{chat.name ?? "Untitled chat"}</span>
                    </Link>
                );
            },
        },
        {
            accessorKey: "updatedAt",
            meta: { className: "text-right" },
            header: () => {
                const isActive = context.sortBy === "updatedAt";
                const Icon = isActive
                    ? (context.sortOrder === "asc" ? ArrowUp : ArrowDown)
                    : ArrowUpDown;
                return (
                    <div className="flex justify-end -mr-4">
                        <Button
                            variant="ghost"
                            onClick={() => context.onSortChange("updatedAt")}
                        >
                            Updated
                            <Icon className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                );
            },
            cell: ({ row }) => {
                const updatedAt = row.original.updatedAt;
                return (
                    <span className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
                    </span>
                );
            },
        },
        {
            id: "actions",
            meta: { width: "50px" },
            cell: ({ row }) => <ChatRowActions chat={row.original} />,
        },
    ];
}

function ChatRowActions({ chat }: { chat: Chat }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const invalidateChats = useCallback(() => {
        router.refresh();
        queryClient.invalidateQueries({ queryKey: ["chats"] });
    }, [queryClient, router]);

    const onRename = useCallback(async (name: string): Promise<boolean> => {
        const response = await updateChatName({ chatId: chat.id, name });
        if (isServiceError(response)) {
            toast({ description: `Failed to rename chat. Reason: ${response.message}` });
            return false;
        }
        toast({ description: "Chat renamed successfully" });
        captureEvent("wa_chat_renamed", { chatId: chat.id });
        invalidateChats();
        return true;
    }, [chat.id, invalidateChats, toast]);

    const onDelete = useCallback(async (): Promise<boolean> => {
        const response = await deleteChat({ chatId: chat.id });
        if (isServiceError(response)) {
            toast({ description: `Failed to delete chat. Reason: ${response.message}` });
            return false;
        }
        toast({ description: "Chat deleted successfully" });
        captureEvent("wa_chat_deleted", { chatId: chat.id });
        invalidateChats();
        return true;
    }, [chat.id, invalidateChats, toast]);

    const onDuplicate = useCallback(async (newName: string): Promise<string | null> => {
        const response = await duplicateChat({ chatId: chat.id, newName });
        if (isServiceError(response)) {
            toast({ description: `Failed to duplicate chat. Reason: ${response.message}` });
            return null;
        }
        toast({ description: "Chat duplicated successfully" });
        captureEvent("wa_chat_duplicated", { chatId: chat.id });
        invalidateChats();
        router.push(`/chat/${response.id}`);
        return response.id;
    }, [chat.id, invalidateChats, router, toast]);

    return (
        <>
            <ChatActionsDropdown
                onRenameClick={() => setIsRenameOpen(true)}
                onDuplicateClick={() => setIsDuplicateOpen(true)}
                onDeleteClick={() => setIsDeleteOpen(true)}
                align="end"
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                >
                    <EllipsisIcon className="h-4 w-4" />
                </Button>
            </ChatActionsDropdown>
            <RenameChatDialog
                isOpen={isRenameOpen}
                onOpenChange={setIsRenameOpen}
                onRename={onRename}
                currentName={chat.name ?? "Untitled chat"}
            />
            <DuplicateChatDialog
                isOpen={isDuplicateOpen}
                onOpenChange={setIsDuplicateOpen}
                onDuplicate={onDuplicate}
                currentName={chat.name ?? "Untitled chat"}
            />
            <DeleteChatDialog
                isOpen={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onDelete={onDelete}
            />
        </>
    );
}

export function ChatsPage() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const query = searchParams.get("query") ?? "";
    const sortBy = (searchParams.get("sortBy") as SortBy) || "updatedAt";
    const sortOrder = (searchParams.get("sortOrder") as SortOrder) || "desc";
    const [searchValue, setSearchValue] = useState(query);
    const isOwnUpdateRef = useRef(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const sentinelRef = useRef<HTMLDivElement>(null);

    useHotkeys("/", (e) => {
        e.preventDefault();
        searchInputRef.current?.focus();
    });

    // Auto-focus search input on mount, cursor at end
    useEffect(() => {
        const el = searchInputRef.current;
        if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, []);

    // Debounced search — updates URL query param
    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (searchValue) {
                params.set("query", searchValue);
            } else {
                params.delete("query");
            }
            isOwnUpdateRef.current = true;
            router.replace(`${pathname}?${params.toString()}`);
        }, 100);

        return () => {
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    // Sync search input on external URL changes (back/forward navigation)
    useEffect(() => {
        if (isOwnUpdateRef.current) {
            isOwnUpdateRef.current = false;
            return;
        }
        setSearchValue(query);
    }, [query]);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isLoading,
        isError,
    } = useInfiniteQuery({
        queryKey: ["chats", query, sortBy, sortOrder],
        queryFn: async ({ pageParam }) => {
            const result = await listChats({ cursor: pageParam, query: query || undefined, sortBy, sortOrder });
            if (isServiceError(result)) {
                throw new Error("Failed to fetch chats");
            }
            return result;
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

    // Intersection observer for infinite scroll
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetching) {
                    fetchNextPage();
                }
            },
            { threshold: 0 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [hasNextPage, isFetching, fetchNextPage]);

    const chats = useMemo(
        () => data?.pages.flatMap((page) => page.chats) ?? [],
        [data]
    );

    const handleSortChange = useCallback((column: SortBy) => {
        const params = new URLSearchParams(searchParams.toString());
        if (sortBy === column) {
            params.set("sortOrder", sortOrder === "asc" ? "desc" : "asc");
        } else {
            params.set("sortBy", column);
            params.set("sortOrder", column === "name" ? "asc" : "desc");
        }
        router.replace(`${pathname}?${params.toString()}`);
    }, [sortBy, sortOrder, searchParams, pathname, router]);

    const columns = useMemo(
        () => getColumns({ sortBy, sortOrder, onSortChange: handleSortChange }),
        [sortBy, sortOrder, handleSortChange]
    );

    const table = useReactTable({
        data: chats,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="flex flex-col h-full max-w-6xl mx-auto p-4">
            <div className="flex flex-col gap-4 p-6 pb-2 flex-shrink-0">
                <h1 className="text-3xl font-semibold">Chats</h1>

                <div className="flex items-center justify-between gap-2">
                    <InputGroup className="flex-1">
                        <InputGroupInput
                            ref={searchInputRef}
                            placeholder="Search your chats..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="ring-0"
                        />
                    </InputGroup>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/chat">
                            <Plus className="h-4 w-4 mr-1" />
                            New chat
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-none px-6">
                <Table className="table-fixed w-full" wrapperClassName="overflow-visible">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    const meta = header.column.columnDef.meta as { width?: string; className?: string } | undefined;
                                    return (
                                        <TableHead
                                            key={header.id}
                                            className={cn("sticky top-0 bg-background z-10", meta?.className)}
                                            style={meta?.width ? { width: meta.width } : undefined}
                                        >
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, idx) => (
                                <TableRow key={idx}>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                    <TableCell />
                                </TableRow>
                            ))
                        ) : isError ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                                    Failed to load chats.
                                </TableCell>
                            </TableRow>
                        ) : chats.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                                    {query ? "No chats matching your search." : "No chats yet."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="group/row">
                                    {row.getVisibleCells().map((cell) => {
                                        const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                                        return (
                                            <TableCell key={cell.id} className={meta?.className}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {!isLoading && !isError && chats.length > 0 && (
                    <>
                        <div ref={sentinelRef} className="h-1" />
                        {isFetchingNextPage && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
