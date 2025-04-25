"use client"

import { useToast } from "@/components/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { changeSubscriptionBillingEmail } from "@/ee/features/billing/actions"
import useCaptureEvent from "@/hooks/useCaptureEvent"
import { useDomain } from "@/hooks/useDomain"
import { isServiceError } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { OrgRole } from "@sourcebot/db"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"

const formSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

interface ChangeBillingEmailCardProps {
    currentUserRole: OrgRole,
    billingEmail: string
}

export function ChangeBillingEmailCard({ currentUserRole, billingEmail }: ChangeBillingEmailCardProps) {
    const domain = useDomain()
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const captureEvent = useCaptureEvent();
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: billingEmail,
        },
    })

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true)
        const newEmail = values.email || billingEmail
        const result = await changeSubscriptionBillingEmail(domain, newEmail)
        if (!isServiceError(result)) {
            toast({
                description: "✅ Billing email updated successfully!",
            })
            captureEvent('wa_billing_email_updated_success', {})
            router.refresh()
        } else {
            toast({
                description: "❌ Failed to update billing email. Please try again.",
            })
            captureEvent('wa_billing_email_updated_fail', {
                error: result.message,
            })
        }
        setIsLoading(false)
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-col gap-4">
                <CardTitle className="flex items-center gap-2">
                    Billing Email
                </CardTitle>
                <CardDescription>The email address for your billing account</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder={billingEmail}
                                            className="max-w-md"
                                            disabled={currentUserRole !== OrgRole.OWNER}
                                            title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the billing email" : undefined}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={isLoading || currentUserRole !== OrgRole.OWNER}
                                title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the billing email" : undefined}
                            >
                                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

