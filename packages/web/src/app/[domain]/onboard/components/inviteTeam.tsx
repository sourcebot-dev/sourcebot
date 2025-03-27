'use client';

import { createInvites } from "@/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlusCircleIcon } from "lucide-react";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { inviteMemberFormSchema } from "../../settings/members/components/inviteMemberCard";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { OnboardingSteps } from "@/lib/constants";
import { useRouter } from "next/navigation";
import useCaptureEvent from "@/hooks/useCaptureEvent";
interface InviteTeamProps {
    nextStep: OnboardingSteps;
}

export const InviteTeam = ({ nextStep }: InviteTeamProps) => {
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

    const onComplete = useCallback(() => {
        router.push(`?step=${nextStep}`);
    }, [nextStep, router]);

    const onSubmit = useCallback(async (data: z.infer<typeof inviteMemberFormSchema>) => {
        const response = await createInvites(data.emails.map(e => e.email), domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to invite members. Reason: ${response.message}`
            });
            captureEvent('wa_onboard_invite_team_invite_fail', {
                error: response.errorCode,
                num_emails: data.emails.length,
            });
        } else {
            toast({
                description: `✅ Successfully invited ${data.emails.length} members`
            });
            captureEvent('wa_onboard_invite_team_invite_success', {
                num_emails: data.emails.length,
            });
            onComplete();
        }
    }, [domain, toast, onComplete, captureEvent]);

    const onSkip = useCallback(() => {
        captureEvent('wa_onboard_invite_team_skip', {
            num_emails: form.getValues().emails.length,
        });
        onComplete();
    }, [onComplete, form, captureEvent]);

    return (
        <Card className="p-12 w-full sm:max-w-[500px]">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                        <FormLabel>Email Address</FormLabel>
                        <FormDescription>{`Invite members to access your organization's Sourcebot instance.`}</FormDescription>
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
                            variant="outline"
                            className="mr-2"
                            type="button"
                            onClick={onSkip}
                        >
                            Skip for now
                        </Button>
                        <Button
                            size="sm"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-0.5 animate-spin" />}
                            Invite
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card >
    )
}