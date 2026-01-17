'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCallback, useState } from "react";
import { z } from "zod";
import { PlusCircleIcon, Loader2, AlertCircle } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createInvites } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import useCaptureEvent from "@/hooks/useCaptureEvent";
export const inviteMemberFormSchema = z.object({
    emails: z.array(z.object({
        email: z.string().email()
    }))
    .refine((emails) => {
        const emailSet = new Set(emails.map(e => e.email.toLowerCase()));
        return emailSet.size === emails.length;
    }, "Duplicate email addresses are not allowed")
});

interface InviteMemberCardProps {
    currentUserRole: OrgRole;
    isBillingEnabled: boolean;
    seatsAvailable?: boolean;
}

export const InviteMemberCard = ({ currentUserRole, isBillingEnabled, seatsAvailable = true }: InviteMemberCardProps) => {
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();   
    const router = useRouter();
    const captureEvent = useCaptureEvent();

    const form = useForm<z.infer<typeof inviteMemberFormSchema>>({
        resolver: zodResolver(inviteMemberFormSchema),
        defaultValues: {
            emails: [{ email: "" }]
        },
    });

    const addEmailField = useCallback(() => {
        const emails = form.getValues().emails;
        form.setValue('emails', [...emails, { email: "" }]);
    }, [form]);

    const onSubmit = useCallback((data: z.infer<typeof inviteMemberFormSchema>) => {
        setIsLoading(true);
        createInvites(data.emails.map(e => e.email), domain)
            .then((res) => {
                if (isServiceError(res)) {
                    toast({
                        description: `❌ Failed to invite members. Reason: ${res.message}`
                    });
                    captureEvent('wa_invite_member_card_invite_fail', {
                        errorCode: res.errorCode,
                        num_emails: data.emails.length,
                    });
                } else {
                    form.reset();
                    router.push(`?tab=invites`);
                    router.refresh();
                    toast({
                        description: `✅ Successfully invited ${data.emails.length} members`
                    });
                    captureEvent('wa_invite_member_card_invite_success', {
                        num_emails: data.emails.length,
                    });
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [domain, form, toast, router, captureEvent]);

    const isDisabled = !seatsAvailable || currentUserRole !== OrgRole.OWNER || isLoading;

    return (
        <>
            <Card className={!seatsAvailable ? "opacity-70" : ""}>
                <CardHeader>
                    <CardTitle>Invite Member</CardTitle>
                    <CardDescription>Invite new members to your organization.</CardDescription>
                </CardHeader>
                {!seatsAvailable && (
                    <div className="px-6 mb-4">
                        <div className="flex items-start space-x-2.5 p-3 rounded-md border border-gray-700 bg-gray-800/50 text-gray-200 shadow-md">
                            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-medium leading-tight text-white">
                                    Maximum seats reached
                                </p>
                                <p className="text-xs mt-1 text-gray-300">
                                    You&apos;ve reached the maximum number of seats for your license. Upgrade your plan to invite additional members.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(() => setIsInviteDialogOpen(true))}>
                        <CardContent className="space-y-4">
                            <FormLabel>Email Address</FormLabel>
                            {form.watch('emails').map((_, index) => (
                                <FormField
                                    key={index}
                                    control={form.control}
                                    name={`emails.${index}.email`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    className="max-w-md"
                                                    placeholder="melissa@example.com"
                                                    disabled={isDisabled}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                            {form.formState.errors.emails?.root?.message && (
                                <FormMessage>{form.formState.errors.emails.root.message}</FormMessage>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addEmailField}
                                disabled={isDisabled}
                            >
                                <PlusCircleIcon className="w-4 h-4 mr-0.5" />
                                Add more
                            </Button>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button
                                size="sm"
                                type="submit"
                                disabled={isDisabled}
                            >
                                {isLoading && <Loader2 className="w-4 h-4 mr-0.5 animate-spin" />}
                                Invite
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
            <AlertDialog
                open={isInviteDialogOpen}
                onOpenChange={setIsInviteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Invite Team Members</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Your team is growing! By confirming, you will be inviting ${form.getValues().emails.length} new members to your organization. ${isBillingEnabled ? "Your subscription's seat count will be adjusted when a member accepts their invitation." : ""}`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto divide-y">
                            {form.getValues().emails.map(({ email }, index) => (
                                <p
                                    key={index}
                                    className="text-sm p-2"
                                >
                                    {email}
                                </p>
                            ))}
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => captureEvent('wa_invite_member_card_invite_cancel', {
                            num_emails: form.getValues().emails.length,
                        })}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onSubmit(form.getValues())}
                        >
                            Invite
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}