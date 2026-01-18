'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn, isServiceError } from "@/lib/utils";
import { ChatVisibility } from "@sourcebot/db";
import { GlobeIcon } from "@radix-ui/react-icons";
import { LockIcon, Router } from "lucide-react";
import { useEffect, useState } from "react";
import { changeChatVisibility } from "@/features/chat/actions";
import { toast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ShareChatDialogButtonProps {
    visibility: ChatVisibility;
    chatId: string;
}

export const ShareChatDialogButton = ({ visibility,chatId }: ShareChatDialogButtonProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedVisibility, setSelectedVisibility] = useState<ChatVisibility>(visibility);
    const router=useRouter()

    useEffect(() => {
        setSelectedVisibility(visibility);
    }, [visibility]);

    const onChangeVisibility = (visibility: ChatVisibility) => {
        changeChatVisibility({
            chatId: chatId,
            visibility,
        }).then((response)=>{
            if (isServiceError(response)) {
                toast({
                    description: `❌ Failed to change chat visibility. Reason: ${response.message}`,
                    variant: "destructive",
                });
            }

            toast({
                description: `Chat visibility changed to ${visibility}`,
            });
            setSelectedVisibility(visibility);
            router.refresh()
        })
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <Button
                size="sm"
                onClick={() => setIsOpen(true)}
            >
                Share
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share chat</DialogTitle>
                    <DialogDescription>
                        Choose who can access this chat.
                    </DialogDescription>
                </DialogHeader>
                <RadioGroup
                    className="grid gap-3"
                    value={selectedVisibility}
                    onValueChange={(value) => onChangeVisibility(value as ChatVisibility)}
                >
                    <Label
                        htmlFor="visibility-public"
                        className={cn(
                            "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                            selectedVisibility === ChatVisibility.PUBLIC
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-accent"
                        )}
                    >
                        <RadioGroupItem id="visibility-public" value={ChatVisibility.PUBLIC} className="sr-only"/>
                        <GlobeIcon className="h-4 w-4 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">Public</p>
                            <p className="text-xs text-muted-foreground">
                                Anyone with the link can view this chat.
                            </p>
                        </div>
                    </Label>
                    <Label
                        htmlFor="visibility-private"
                        className={cn(
                            "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                            selectedVisibility === ChatVisibility.PRIVATE
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-accent"
                        )}
                    >
                        <RadioGroupItem id="visibility-private" value={ChatVisibility.PRIVATE} className="sr-only"/>
                        <LockIcon className="h-4 w-4 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">Private</p>
                            <p className="text-xs text-muted-foreground">
                                Only you can view and edit this chat.
                            </p>
                        </div>
                    </Label>
                </RadioGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
