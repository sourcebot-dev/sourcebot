"use client"

import { checkIfOrgDomainExists, createOrg } from "../../../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback } from "react";
import { isServiceError } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card"
import useCaptureEvent from "@/hooks/useCaptureEvent";


export function OrgCreateForm() {
    const { toast } = useToast();
    const router = useRouter();
    const captureEvent = useCaptureEvent();
    
    const onboardingFormSchema = z.object({
        name: z.string()
            .min(2, { message: "Organization name must be at least 3 characters long." })
            .max(30, { message: "Organization name must be at most 30 characters long." }),
        domain: z.string()
            .min(2, { message: "Organization domain must be at least 3 characters long." })
            .max(20, { message: "Organization domain must be at most 20 characters long." })
            .regex(/^[a-z][a-z-]*[a-z]$/, {
                message: "Domain must start and end with a letter, and can only contain lowercase letters and dashes.",
            })
            .refine(async (domain) => {
                const doesDomainExist = await checkIfOrgDomainExists(domain);
                if (!isServiceError(doesDomainExist)) {
                    captureEvent('wa_onboard_org_create_fail', {
                        error: "Domain already exists",
                    })
                }
                return isServiceError(doesDomainExist) || !doesDomainExist;
            }, "This domain is already taken."),
    })

    const form = useForm<z.infer<typeof onboardingFormSchema>>({
        resolver: zodResolver(onboardingFormSchema),
        defaultValues: {
            name: "",
            domain: "",
        }
    });
    const { isSubmitting } = form.formState;

    const onSubmit = useCallback(async (data: z.infer<typeof onboardingFormSchema>) => {
        const response = await createOrg(data.name, data.domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create organization. Reason: ${response.message}`
            })
            captureEvent('wa_onboard_org_create_fail', {
                error: response.errorCode,
            })
        } else {
            router.push(`/${data.domain}/onboard`);
            captureEvent('wa_onboard_org_create_success', {})
        }
    }, [router, toast, captureEvent]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        const domain = name.toLowerCase().replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g, "-")
        form.setValue("domain", domain)
    }

    return (
        <Card className="flex flex-col border p-12 space-y-6 bg-background w-96">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization Name</FormLabel>
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
                            <FormItem>
                                <FormLabel>Organization Domain</FormLabel>
                                <FormControl>
                                    <div className="flex items-center">
                                        <span className="ml-2">staging.sourcebot.dev/</span>
                                        <Input placeholder="aperature-labs" {...field} className="w-1/2" />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button
                        variant="default"
                        className="w-full"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create
                    </Button>
                </form>
            </Form>
        </Card>
    )
}
