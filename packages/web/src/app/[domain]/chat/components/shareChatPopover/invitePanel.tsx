'use client';

import { searchChatShareableMembers } from "@/app/api/(client)/client";
import { SearchChatShareableMembersResponse } from "@/app/api/(server)/chat/[chatId]/searchMembers/route";
import { SessionUser } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/ui/separator";
import { unwrapServiceError } from "@/lib/utils";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { ChevronLeft, Circle, CircleCheck, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

interface InvitePanelProps {
    chatId: string;
    onBack: () => void;
    onShareChatWithUsers: (users: SessionUser[]) => Promise<boolean>;
}


export const InvitePanel = ({
    chatId,
    onBack,
    onShareChatWithUsers,
}: InvitePanelProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<SessionUser[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const resultsRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const getInitials = (name?: string, email?: string) => {
        if (name) {
            return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (email) {
            return email[0].toUpperCase();
        }
        return '?';
    };


    const debouncedSearchQuery = useDebounce(searchQuery, 100);

    const { data: searchResults, isPending, isError } = useQuery<SearchChatShareableMembersResponse>({
        queryKey: ['search-chat-shareable-members', chatId, debouncedSearchQuery],
        queryFn: () => unwrapServiceError(searchChatShareableMembers({ chatId, query: debouncedSearchQuery}))
    })

    const isUserSelected = (userId: string) => {
        return selectedUsers.some(u => u.id === userId);
    };

    return (
        /* Invite View */
        <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 py-3 px-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onBack}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-medium">Invite Users</p>
            </div>
            <Separator />

            {/* Search */}
            <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-1 min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-within:ring-1 focus-within:ring-ring">
                    {selectedUsers.map(user => (
                        <Badge key={user.id} variant="secondary" className="gap-1 shrink-0">
                            {user.email}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
                            />
                        </Badge>
                    ))}
                    <input
                        ref={inputRef}
                        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder={selectedUsers.length === 0 ? "Search for a user" : ""}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const firstButton = resultsRef.current?.querySelector('button');
                                firstButton?.focus();
                            }
                        }}
                        autoFocus={true}
                    />
                </div>

                {/* Search Results / Selected Users */}
                <div className="min-h-[100px] max-h-[240px] overflow-y-auto p-1 -m-1">
                    {isPending ? (
                        <div className="py-6 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : isError ? (
                        <p className="text-sm text-muted-foreground py-2">Error loading search results</p>
                    ) : searchQuery && searchResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No results</p>
                    ) : searchResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Search for users to invite</p>
                    ) : (
                        <div ref={resultsRef} className="space-y-1">
                            {searchResults.map((user, index) => {
                                const selected = isUserSelected(user.id);
                                return (
                                    <Button
                                        key={user.id}
                                        variant="ghost"
                                        onClick={() => {
                                            setSelectedUsers(prev => {
                                                const isSelected = prev.some(u => u.id === user.id);
                                                if (isSelected) {
                                                    return prev.filter(u => u.id !== user.id);
                                                } else {
                                                    setSearchQuery('');
                                                    return [...prev, user];
                                                }
                                            });
                                        }}
                                        onKeyDown={(e) => {
                                            const buttons = resultsRef.current?.querySelectorAll('button');
                                            if (!buttons) return;

                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                const nextButton = buttons[index + 1];
                                                nextButton?.focus();
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                if (index === 0) {
                                                    inputRef.current?.focus();
                                                } else {
                                                    const prevButton = buttons[index - 1];
                                                    prevButton?.focus();
                                                }
                                            }
                                        }}
                                        className="w-full justify-start h-auto py-2 px-2"
                                    >
                                        {selected ? (
                                            <CircleCheck className="h-5 w-5 text-primary shrink-0" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                                        )}
                                        <Avatar className="h-8 w-8 ml-2">
                                            <AvatarImage src={user.image ?? placeholderAvatar.src} />
                                            <AvatarFallback>{getInitials(user.name ?? undefined, user.email ?? undefined)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col items-start ml-1">
                                            <span className="text-sm font-medium">{user.name || user.email}</span>
                                            {user.name && (
                                                <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
                                            )}
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <Separator />

            {/* Invite Button */}
            <div className="p-4">
                <LoadingButton
                    onClick={async () => {
                        setIsInviting(true);
                        await onShareChatWithUsers(selectedUsers);
                        setIsInviting(false);
                    }}
                    disabled={selectedUsers.length === 0 || isInviting}
                    loading={isInviting}
                    className="w-full"
                    variant={selectedUsers.length > 0 ? "default" : "secondary"}
                >
                    {selectedUsers.length > 0 ? (
                        `Invite ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}`
                    ) : (
                        "Invite"
                    )}
                </LoadingButton>
            </div>
        </div>
    );
};
