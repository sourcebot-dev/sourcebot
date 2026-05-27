'use client';

import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const emailFormSchema = z.object({
    email: z.string().email(),
});

interface CheckoutDisclosuresProps {
    sessionEmail: string;
    onEmailChanged: (email: string) => void;
}

export const CheckoutDisclosures = ({ sessionEmail, onEmailChanged }: CheckoutDisclosuresProps) => {
    const [isEditing, setIsEditing] = useState(false);

    const form = useForm<z.infer<typeof emailFormSchema>>({
        resolver: zodResolver(emailFormSchema),
        defaultValues: { email: sessionEmail },
        mode: "onChange",
    });

    // Sync once when sessionEmail arrives — the parent's useSession may pass an
    // empty value on the first render and populate afterwards.
    useEffect(() => {
        if (sessionEmail && !form.getValues("email")) {
            form.reset({ email: sessionEmail });
        }
    }, [sessionEmail, form]);

    useEffect(() => {
        if (isEditing) {
            form.setFocus("email");
        }
    }, [isEditing, form]);

    const email = form.watch("email");
    const isValid = !form.formState.errors.email;

    useEffect(() => {
        if (isValid && email && !isEditing) {
            onEmailChanged(email);
        }
    }, [email, isValid, isEditing, onEmailChanged]);

    const commit = () => {
        if (!isValid) {
            return;
        }
        setIsEditing(false);
    };

    const revertAndExit = () => {
        form.reset({ email: sessionEmail });
        setIsEditing(false);
    };

    return (
        <div className="text-xs text-muted-foreground text-center space-y-1">
            {sessionEmail && (
                <div className="inline-flex items-center justify-center gap-1.5">
                    <span>Your activation code will be sent to</span>
                    {isEditing ? (
                        <Form {...form}>
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="space-y-0">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="email"
                                                onBlur={() => {
                                                    if (!isValid) {
                                                        revertAndExit();
                                                    } else {
                                                        setIsEditing(false);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commit();
                                                    } else if (e.key === "Escape") {
                                                        revertAndExit();
                                                    }
                                                }}
                                                aria-invalid={!isValid}
                                                className={cn(
                                                    "h-6 px-1.5 py-0 text-xs w-56",
                                                    !isValid && "border-destructive focus-visible:ring-destructive",
                                                )}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </Form>
                    ) : (
                        <>
                            <span className="font-medium text-foreground">{email}</span>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Edit email"
                            >
                                <Pencil className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
