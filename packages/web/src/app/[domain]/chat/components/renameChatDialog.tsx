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

interface RenameChatDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onRename: (name: string) => Promise<boolean>;
    currentName: string;
}

export const RenameChatDialog = ({ isOpen, onOpenChange, onRename, currentName }: RenameChatDialogProps) => {
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
            name: currentName,
        });
    }, [currentName, form]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        try {
            const success = await onRename(data.name);
            if (success) {
                form.reset();
                onOpenChange(false);
            }
        } catch (e) {
            console.error('Failed to rename chat', e);
        } finally {
            setIsLoading(false);
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
                    <DialogTitle>Rename Chat</DialogTitle>
                    <DialogDescription className="sr-only">
                        {`Rename "${currentName ?? 'untitled chat'}" to a new name.`}
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
                                    <FormLabel className="font-normal">New chat title</FormLabel>
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
                        Rename
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
