'use client';

import { updateOrgDomain } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { NEXT_PUBLIC_ROOT_DOMAIN } from "@/lib/environment.client";
import { orgDomainSchema } from "@/lib/schemas";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrgRole } from "@sourcebot/db";
import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
    domain: orgDomainSchema,
})

interface ChangeOrgDomainCardProps {
    currentUserRole: OrgRole,
    orgDomain: string,
}

export function ChangeOrgDomainCard({ orgDomain, currentUserRole }: ChangeOrgDomainCardProps) {
    const domain = useDomain()
    const { toast } = useToast()
    const captureEvent = useCaptureEvent();
    const router = useRouter();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            domain: orgDomain,
        },
    })
    const { isSubmitting } = form.formState;

    const onSubmit = useCallback(async (data: z.infer<typeof formSchema>) => {
        const result = await updateOrgDomain(data.domain, domain);
        if (isServiceError(result)) {
            toast({
                description: `❌ Failed to update organization url. Reason: ${result.message}`,
            })
            captureEvent('wa_org_domain_updated_fail', {
                error: result.errorCode,
            });
        } else {
            toast({
                description: "✅ Organization url updated successfully",
            });
            captureEvent('wa_org_domain_updated_success', {});
            router.replace(`/${data.domain}/settings`);
        }
    }, [domain, router, toast, captureEvent]);

    return (
        <>
            <Card className="w-full">
                <CardHeader className="flex flex-col gap-4">
                    <CardTitle className="flex items-center gap-2">
                        Organization URL
                    </CardTitle>
                    <CardDescription>{`Your organization's URL namespace. This is where your organization's Sourcebot instance will be accessible.`}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="domain"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <div className="flex items-center w-full">
                                                <div className="flex-shrink-0 text-sm text-muted-foreground bg-backgroundSecondary rounded-md rounded-r-none border border-r-0 px-3 py-[9px]">{NEXT_PUBLIC_ROOT_DOMAIN}/</div>
                                                <Input
                                                    placeholder={orgDomain}
                                                    {...field}
                                                    disabled={currentUserRole !== OrgRole.OWNER}
                                                    title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the organization url" : undefined}
                                                    className="flex-1 rounded-l-none max-w-xs"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            disabled={isSubmitting || currentUserRole !== OrgRole.OWNER}
                                            title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the organization url" : undefined}
                                        >
                                            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Save
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-destructive" /> Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Any links pointing to the current organization URL will <strong>no longer work</strong>.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    form.handleSubmit(onSubmit)(e);
                                                    setIsDialogOpen(false);
                                                }}
                                            >
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

        </>
    )
}
