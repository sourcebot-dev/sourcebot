'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface DuplicateChatDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDuplicate: (name: string) => Promise<string | null>;
    currentName: string;
}

export const DuplicateChatDialog = ({ isOpen, onOpenChange, onDuplicate, currentName }: DuplicateChatDialogProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const formSchema = z.object({
        name: z.string().min(1),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
        },
    });

    useEffect(() => {
        form.reset({
            name: `${currentName} (copy)`,
        });
    }, [currentName, form]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const newChatId = await onDuplicate(data.name);
        setIsLoading(false);

        if (newChatId) {
            form.reset();
            onOpenChange(false);
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!isLoading) {
                    onOpenChange(open);
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Duplicate Chat</DialogTitle>
                    <DialogDescription>
                        Create a copy of this chat to edit in a new session.
                    </DialogDescription>
                </DialogHeader>
                <Form
                    {...form}
                >
                    <form
                        className="space-y-4 flex flex-col w-full py-2"
                        onSubmit={(event) => {
                            event.stopPropagation();
                            form.handleSubmit(onSubmit)(event);
                        }}
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem
                                    className="flex flex-col gap-2"
                                >
                                    <FormLabel className="font-normal">New chat name</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Enter chat name"
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isLoading}
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <LoadingButton
                        loading={isLoading}
                        onClick={() => {
                            form.handleSubmit(onSubmit)();
                        }}
                    >
                        Duplicate
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
