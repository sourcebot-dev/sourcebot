"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { changeSubscriptionBillingEmail, getSubscriptionBillingEmail } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { useDomain } from "@/hooks/useDomain"
import { OrgRole } from "@sourcebot/db"
import { useEffect, useState } from "react"
import { Mail } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useToast } from "@/components/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

interface ChangeBillingEmailCardProps {
  currentUserRole: OrgRole
}

export function ChangeBillingEmailCard({ currentUserRole }: ChangeBillingEmailCardProps) {
  const domain = useDomain()
  const [billingEmail, setBillingEmail] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  useEffect(() => {
    const fetchBillingEmail = async () => {
      const email = await getSubscriptionBillingEmail(domain)
      if (!isServiceError(email)) {
        setBillingEmail(email)
      }
    }
    fetchBillingEmail()
  }, [domain])

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    const newEmail = values.email || billingEmail
    const result = await changeSubscriptionBillingEmail(domain, newEmail)
    if (!isServiceError(result)) {
      setBillingEmail(newEmail)
      form.reset({ email: "" })
      toast({
        description: "✅ Billing email updated successfully!",
      })
    } else {
      toast({
        description: "❌ Failed to update billing email. Please try again.",
      })
    }
    setIsLoading(false)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
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
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={billingEmail} 
                      {...field}
                      disabled={currentUserRole !== OrgRole.OWNER}
                      title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the billing email" : undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || currentUserRole !== OrgRole.OWNER}
              title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change the billing email" : undefined}
            >
              {isLoading ? "Updating..." : "Update Billing Email"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

