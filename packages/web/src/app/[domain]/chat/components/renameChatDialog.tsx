'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface RenameChatDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onRename: (name: string) => void;
    currentName: string;
}

export const RenameChatDialog = ({ isOpen, onOpenChange, onRename, currentName }: RenameChatDialogProps) => {
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
    }, [currentName]);

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        onRename(data.name);
        form.reset();
        onOpenChange(false);
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onOpenChange}
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
                        className="space-y-4 flex flex-col w-full"
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
                                    <FormControl
                                    >
                                        <Input
                                            {...field}
                                            placeholder="Enter chat name"
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
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            form.handleSubmit(onSubmit)();
                        }}
                    >
                        Rename
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}