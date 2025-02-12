"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { createOrg } from "@/actions"

const formSchema = z.object({
  organizationName: z.string().min(2, {
    message: "Organization name must be at least 2 characters.",
  }),
  organizationDomain: z.string().regex(/^[a-z-]+$/, {
    message: "Domain can only contain lowercase letters and dashes.",
  }),
})

export default function Onboard() {
  const [_defaultDomain, setDefaultDomain] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organizationName: "",
      organizationDomain: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    createOrg(values.organizationName, values.organizationDomain)
        .then(() => {
        })
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const domain = name.toLowerCase().replace(/\s+/g, "-")
    setDefaultDomain(domain)
    form.setValue("organizationDomain", domain)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>Enter your organization details below.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Acme Inc"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleNameChange(e)
                      }}
                    />
                  </FormControl>
                  <FormDescription>{`This is your organization's full name.`}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Domain</FormLabel>
                  <FormControl>
                    <Input placeholder="acme-inc" {...field} />
                  </FormControl>
                  <FormDescription>{`This will be used for your organization's URL.`}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

