'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { updateChatVisibility } from "@/features/chat/actions";
import { isServiceError } from "@/lib/utils";
import { ChatVisibility } from "@sourcebot/db";
import { Info, Link2Icon, Lock, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

interface SharePopoverProps {
    chatId: string;
    visibility: ChatVisibility;
}

export const SharePopover = ({ chatId, visibility }: SharePopoverProps) => {
    const [currentVisibility, setCurrentVisibility] = useState(visibility);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleVisibilityChange = useCallback(async (newVisibility: ChatVisibility) => {
        setIsUpdating(true);
        const response = await updateChatVisibility({
            chatId,
            visibility: newVisibility,
        });

        if (isServiceError(response)) {
            toast({
                description: `Failed to update visibility: ${response.message}`,
                variant: "destructive",
            });
        } else {
            setCurrentVisibility(newVisibility);
            toast({
                description: "✅ Chat visibility updated"
            });
            router.refresh();
        }
        setIsUpdating(false);
    }, [chatId, toast, router]);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href);
        toast({
            description: "✅ Link copied to clipboard",
        });
    }, [toast]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                >
                    {currentVisibility === ChatVisibility.PUBLIC ? (
                        <Link2Icon className="h-4 w-4" />
                    ) : (
                        <LockIcon className="h-4 w-4" />
                    )}
                    Share
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] py-3 px-4">
                <div className="flex flex-col">
                    <p className="text-sm font-medium">Share</p>
                    <Separator className="-mx-4 w-auto mt-2 mb-4" />
                    <label className="text-sm text-muted-foreground mb-3">
                        Visibility
                    </label>
                    <Select
                        value={currentVisibility}
                        onValueChange={(value) => handleVisibilityChange(value as ChatVisibility)}
                        disabled={isUpdating}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ChatVisibility.PRIVATE}>
                                <div className="flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Private
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
            </PopoverContent>
        </Popover>
    );
};
