"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/hooks/use-toast";
import { createInvites } from "@/features/membership/actions";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface InviteMembersDialogProps {
    className?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseEmails = (value: string) => {
    return value
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
};

const inviteMembersFormSchema = z.object({
    emails: z.string().trim().superRefine((value, ctx) => {
        const emails = parseEmails(value);

        if (emails.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Enter at least one email address.",
            });
            return;
        }

        const invalidEmail = emails.find((email) => !emailPattern.test(email));
        if (invalidEmail) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${invalidEmail} is not a valid email address.`,
            });
            return;
        }

        const normalizedEmails = emails.map((email) => email.toLowerCase());
        if (new Set(normalizedEmails).size !== normalizedEmails.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Duplicate email addresses are not allowed.",
            });
        }
    }),
});

type InviteMembersFormValues = z.infer<typeof inviteMembersFormSchema>;

export const InviteMembersDialog = ({ className }: InviteMembersDialogProps) => {
    const [open, setOpen] = useState(false);
    const [shouldFocusEmails, setShouldFocusEmails] = useState(false);
    const emailsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const router = useRouter();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const form = useForm<InviteMembersFormValues>({
        resolver: zodResolver(inviteMembersFormSchema),
        defaultValues: {
            emails: "",
        },
    });

    const isSubmitting = form.formState.isSubmitting;
    const emailsValue = form.watch("emails");
    const emails = parseEmails(emailsValue);
    const emailsRegistration = form.register("emails");

    const focusEmailsField = () => {
        form.setFocus("emails");
        window.setTimeout(() => {
            emailsTextareaRef.current?.focus({ preventScroll: true });
        }, 0);
    };

    useEffect(() => {
        if (!shouldFocusEmails || isSubmitting) {
            return;
        }

        focusEmailsField();
        setShouldFocusEmails(false);
        // `form` is intentionally omitted here. The effect should run when the
        // failed submit settles and the textarea is no longer disabled.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldFocusEmails, isSubmitting]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (isSubmitting) {
            return;
        }

        if (!nextOpen && emailsValue.trim().length > 0) {
            captureEvent("wa_invite_member_card_invite_cancel", {
                num_emails: emails.length,
            });
        }

        if (!nextOpen) {
            form.reset();
        }

        setOpen(nextOpen);
    };

    const onSubmit = async (values: InviteMembersFormValues) => {
        const emails = parseEmails(values.emails);
        try {
            const result = await createInvites(emails);
            if (isServiceError(result)) {
                form.setError("emails", {
                    type: "server",
                    message: result.message,
                }, {
                    shouldFocus: true,
                });
                setShouldFocusEmails(true);
                toast({ description: `Failed to send invites. Reason: ${result.message}` });
                captureEvent("wa_invite_member_card_invite_fail", {
                    errorCode: result.errorCode,
                    num_emails: emails.length,
                });
                return;
            }

            toast({ description: `Successfully sent ${emails.length} invite${emails.length === 1 ? "" : "s"}.` });
            captureEvent("wa_invite_member_card_invite_success", {
                num_emails: emails.length,
            });
            form.reset();
            setOpen(false);
            router.refresh();
        } catch {
            form.setError("emails", {
                type: "server",
                message: "Something went wrong while sending invites.",
            }, {
                shouldFocus: true,
            });
            setShouldFocusEmails(true);
            toast({ description: "Failed to send invites." });
        }
    };

    const onInvalidSubmit = () => {
        setShouldFocusEmails(true);
    };

    const isSendDisabled = isSubmitting || emails.length === 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button type="button" size="sm" className={className} onClick={() => setOpen(true)}>
                Invite
            </Button>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Invite members</DialogTitle>
                    <DialogDescription>
                        Invite new members to your organization.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="emails"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            {...field}
                                            ref={(node) => {
                                                emailsRegistration.ref(node);
                                                emailsTextareaRef.current = node;
                                            }}
                                            onChange={(event) => {
                                                field.onChange(event);
                                                form.clearErrors("emails");
                                            }}
                                            onKeyDown={(event) => {
                                                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                                    event.preventDefault();
                                                    void form.handleSubmit(onSubmit, onInvalidSubmit)();
                                                }
                                            }}
                                            placeholder="email@sourcebot.dev, email2@sourcebot.dev..."
                                            className="min-h-32 resize-none text-base md:text-sm"
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isSendDisabled}>
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Send invites
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
