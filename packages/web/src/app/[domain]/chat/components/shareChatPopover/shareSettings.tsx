'use client';

import { SessionUser } from "@/auth";
import { useToast } from "@/components/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { ChatVisibility } from "@sourcebot/db";
import { Info, Link2Icon, Loader2, Lock, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

interface ShareSettingsProps {
    visibility: ChatVisibility;
    onVisibilityChange: (visibility: ChatVisibility) => Promise<boolean>;
    onRemoveSharedWithUser: (userId: string) => Promise<boolean>;
    onOpenInviteView: () => void;
    currentUser?: SessionUser;
    sharedWithUsers: SessionUser[];
}

export const ShareSettings = ({
    visibility,
    onVisibilityChange,
    onRemoveSharedWithUser,
    onOpenInviteView,
    currentUser,
    sharedWithUsers,
}: ShareSettingsProps) => {
    const [isVisibilityUpdating, setIsVisibilityUpdating] = useState(false);
    const [removingUserIds, setRemovingUserIds] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    const pathname = usePathname();
    const isAuthenticated = !!currentUser;

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            description: "✅ Link copied to clipboard",
        });
    }, [toast]);

    const getInitials = (name?: string | null, email?: string | null) => {
        if (name) {
            return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (email) {
            return email[0].toUpperCase();
        }
        return '?';
    };

    return (
        <div className="flex flex-col py-3 px-4">
            <p className="text-sm font-medium">Share</p>
            <Separator className="-mx-4 w-auto mt-2 mb-4" />

            {/* Fake Search Bar - Click to open invite view */}
            {isAuthenticated && (
                <>
                    <Button
                        variant="outline"
                        className="w-full justify-start text-muted-foreground font-normal"
                        onClick={onOpenInviteView}
                    >
                        Search for a user
                    </Button>

                    {/* People with access */}
                    <div className="mt-4">
                        <label className="text-sm text-muted-foreground mb-2 block">
                            People with access
                        </label>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto pr-3">
                            {/* Owner (current user) */}
                            {currentUser && (
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={currentUser.image ?? placeholderAvatar.src} />
                                            <AvatarFallback>{getInitials(currentUser.name, currentUser.email)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {currentUser.name || currentUser.email}
                                                <span className="text-muted-foreground font-normal"> (you)</span>
                                            </span>
                                            {currentUser.name && currentUser.email && (
                                                <span className="text-xs text-muted-foreground">{currentUser.email}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Shared users */}
                            {sharedWithUsers.map((user) => (
                                <div key={user.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={user.image ?? placeholderAvatar.src} />
                                            <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{user.name || user.email}</span>
                                            {user.name && (
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        disabled={removingUserIds.has(user.id)}
                                        onClick={async () => {
                                            setRemovingUserIds(prev => new Set(prev).add(user.id));
                                            await onRemoveSharedWithUser(user.id);
                                            setRemovingUserIds(prev => {
                                                const next = new Set(prev);
                                                next.delete(user.id);
                                                return next;
                                            });
                                        }}
                                    >
                                        {removingUserIds.has(user.id) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <X className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator className="-mx-4 w-auto my-4" />
                </>
            )}

            <label className="text-sm text-muted-foreground mb-3">
                Visibility
            </label>
            <Select
                value={visibility}
                onValueChange={async (value) => {
                    setIsVisibilityUpdating(true);
                    await onVisibilityChange(value as ChatVisibility);
                    setIsVisibilityUpdating(false);
                }}
                disabled={isVisibilityUpdating || !isAuthenticated}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ChatVisibility.PRIVATE}>
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Only people with access
                        </div>
                    </SelectItem>
                    <SelectItem value={ChatVisibility.PUBLIC}>
                        <div className="flex items-center gap-2">
                            <Link2Icon className="h-4 w-4" />
                            Anyone with the link
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>
            {!isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-2">
                    <Link href={`/login?callbackUrl=${encodeURIComponent(pathname)}`} className="underline">Sign in</Link> to change chat visibility.
                </p>
            )}
            <Separator className="-mx-4 w-auto my-4" />
            <div className="flex justify-between items-center">
                {/* @todo: link to docs */}
                <Link
                    href="#"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Info className="h-4 w-4" />
                    How does sharing chats work?
                </Link>
                <Button
                    variant="outline"
                    onClick={handleCopyLink}
                    className="gap-2"
                >
                    <Link2Icon className="h-4 w-4" />
                    Copy Link
                </Button>
            </div>
        </div>
    );
};
