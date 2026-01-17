'use client';

import { updateOrgName } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { orgNameSchema } from "@/lib/schemas";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrgRole } from "@sourcebot/db";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
    name: orgNameSchema,
})

interface ChangeOrgNameCardProps {
    currentUserRole: OrgRole,
    orgName: string,
}

export function ChangeOrgNameCard({ orgName, currentUserRole }: ChangeOrgNameCardProps) {
    const domain = useDomain()
    const { toast } = useToast()
    const captureEvent = useCaptureEvent();
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: orgName,
        },
    })
    const { isSubmitting } = form.formState;

    const onSubmit = useCallback(async (data: z.infer<typeof formSchema>) => {
        const result = await updateOrgName(data.name, domain);
        if (isServiceError(result)) {
            toast({
                description: `❌ Failed to update organization name. Reason: ${result.message}`,
            })
            captureEvent('wa_org_name_updated_fail', {
                errorCode: result.errorCode,
            });
        } else {
            toast({
                description: "✅ Organization name updated successfully",
            });
            captureEvent('wa_org_name_updated_success', {});
            router.refresh();
        }
    }, [domain, router, toast, captureEvent]);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4">
                <CardTitle>
                    Organization Name
                </CardTitle>
                <CardDescription>{`Your organization's visible name within Sourcebot. For example, the name of your company or department.`}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder={orgName}
                                            className="max-w-sm"
                                            disabled={currentUserRole !== OrgRole.OWNER}
                                            title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the organization name" : undefined}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={isSubmitting || currentUserRole !== OrgRole.OWNER}
                                title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the organization name" : undefined}
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

