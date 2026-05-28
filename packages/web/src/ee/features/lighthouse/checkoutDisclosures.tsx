'use client';

import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const emailFormSchema = z.object({
    email: z.string().email(),
});

interface CheckoutDisclosuresProps {
    sessionEmail: string;
    onEmailChanged: (email: string) => void;
    showNoCreditCardRequired?: boolean;
}

export const CheckoutDisclosures = ({ sessionEmail, onEmailChanged, showNoCreditCardRequired }: CheckoutDisclosuresProps) => {
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
                <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    {showNoCreditCardRequired && (
                        <>
                            <span>No credit card required</span>
                            <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                        </>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                        <span>Your activation code will be sent to</span>
                        {isEditing ? (
                            <Form {...form}>
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-0">
                                            <FormControl>
                                                <input
                                                    {...field}
                                                    type="email"
                                                    autoComplete="off"
                                                    data-1p-ignore="true"
                                                    data-lpignore="true"
                                                    data-form-type="other"
                                                    data-bwignore="true"
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
                                                        "bg-transparent border-none outline-none p-0 m-0 font-medium text-foreground [font:inherit] [letter-spacing:inherit] [field-sizing:content] min-w-[8ch]",
                                                        !isValid && "text-destructive",
                                                    )}
                                                    style={{ fontWeight: 500 }}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={commit}
                                    disabled={!isValid}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label="Save email (press Escape to cancel)"
                                    title="Press Escape to cancel"
                                >
                                    <Save className="h-3 w-3" />
                                </button>
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
                    </span>
                </div>
            )}
        </div>
    );
}
