"use client"

import { createOrg } from "../../../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useState } from "react";
import { isServiceError } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card"
import { NEXT_PUBLIC_ROOT_DOMAIN } from "@/lib/environment.client";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { orgNameSchema, orgDomainSchema } from "@/lib/schemas"


export function OrgCreateForm() {
    const { toast } = useToast();
    const router = useRouter();
    const captureEvent = useCaptureEvent();
    const [isLoading, setIsLoading] = useState(false);

    const onboardingFormSchema = z.object({
        name: orgNameSchema,
        domain: orgDomainSchema,
    })

    const form = useForm<z.infer<typeof onboardingFormSchema>>({
        resolver: zodResolver(onboardingFormSchema),
        defaultValues: {
            name: "",
            domain: "",
        }
    });

    const onSubmit = useCallback(async (data: z.infer<typeof onboardingFormSchema>) => {
        setIsLoading(true);
        const response = await createOrg(data.name, data.domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create organization. Reason: ${response.message}`
            })
            captureEvent('wa_onboard_org_create_fail', {
                error: response.errorCode,
            })
            setIsLoading(false);
        } else {
            router.push(`/${data.domain}/onboard`);
            captureEvent('wa_onboard_org_create_success', {});
            // @note: we don't want to set isLoading to false here since we want to show the loading
            // spinner until the page is redirected.
        }
    }, [router, toast, captureEvent]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        const domain = name.toLowerCase().replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g, "-")
        form.setValue("domain", domain)
    }

    return (
        <Card className="flex flex-col border p-8 bg-background w-full max-w-md">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="flex flex-col gap-2">
                                <FormLabel>Organization Name</FormLabel>
                                <FormDescription>{`Your organization's visible name within Sourcebot. For example, the name of your company or department.`}</FormDescription>
                                <FormControl>
                                    <Input
                                        placeholder="Aperture Labs"
                                        {...field}
                                        autoFocus
                                        onChange={(e) => {
                                            field.onChange(e)
                                            handleNameChange(e)
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="domain"
                        render={({ field }) => (
                            <FormItem className="flex flex-col gap-2">
                                <FormLabel>Organization URL</FormLabel>
                                <FormDescription>{`Your organization's URL namespace. This is where your organization's Sourcebot instance will be accessible.`}</FormDescription>
                                <FormControl>
                                    <div className="flex items-center w-full">
                                        <div className="flex-shrink-0 text-sm text-muted-foreground bg-backgroundSecondary rounded-md rounded-r-none border border-r-0 px-3 py-[9px]">{NEXT_PUBLIC_ROOT_DOMAIN}/</div>
                                        <Input
                                            placeholder="aperture-labs"
                                            {...field}
                                            className="flex-1 rounded-l-none"
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button variant="default" className="w-full" type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create
                    </Button>
                </form>
            </Form>
        </Card>
    )
}
