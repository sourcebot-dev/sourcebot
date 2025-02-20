'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCallback, useState } from "react";
import { z } from "zod";
import { PlusCircleIcon, Loader2 } from "lucide-react";
import { OrgRole } from "@prisma/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createInvites } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

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
}

export const InviteMemberCard = ({ currentUserRole }: InviteMemberCardProps) => {
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();   
    const router = useRouter();

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
                } else {
                    form.reset();
                    router.push(`?tab=invites`);
                    router.refresh();
                    toast({
                        description: `✅ Successfully invited ${data.emails.length} members`
                    });
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [domain, form, toast, router]);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Invite Member</CardTitle>
                    <CardDescription>Invite new members to your organization.</CardDescription>
                </CardHeader>
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
                                                    placeholder="melissa@example.com"
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
                            >
                                <PlusCircleIcon className="w-4 h-4 mr-0.5" />
                                Add more
                            </Button>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button
                                size="sm"
                                type="submit"
                                disabled={currentUserRole !== OrgRole.OWNER || isLoading}
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
                            {`Your team is growing! By confirming, you will be inviting ${form.getValues().emails.length} new members to your organization. Your subscription's seat count will be adjusted when a member accepts their invitation.`}
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
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
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