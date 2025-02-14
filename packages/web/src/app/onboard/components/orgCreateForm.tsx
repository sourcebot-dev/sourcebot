"use client"

import { checkIfOrgDomainExists } from "../../../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { isServiceError } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import Image from "next/image";
import { useState } from "react";

const onboardingFormSchema = z.object({
    name: z.string()
        .min(2, { message: "Organization name must be at least 3 characters long." })
        .max(30, { message: "Organization name must be at most 30 characters long." }),
    domain: z.string()
        .min(2, { message: "Organization domain must be at least 3 characters long." })
        .max(20, { message: "Organization domain must be at most 20 characters long." })
        .regex(/^[a-z][a-z-]*[a-z]$/, {
            message: "Domain must start and end with a letter, and can only contain lowercase letters and dashes.",
          }),
})

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>

const defaultValues: Partial<OnboardingFormValues> = {
    name: "",
    domain: "",
}

interface OrgCreateFormProps {
    setOrgCreateData: (data: OnboardingFormValues) => void;
}

export function OrgCreateForm({ setOrgCreateData }: OrgCreateFormProps) {
    const form = useForm<OnboardingFormValues>({ resolver: zodResolver(onboardingFormSchema), defaultValues })
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function submitOrgInfoForm(data: OnboardingFormValues) {
        const res = await checkIfOrgDomainExists(data.domain);
        if (isServiceError(res)) {
            setErrorMessage("An error occurred while checking the domain. Please try clearing your cookies and trying again.");
            return;
        }

        if (res) {
            setErrorMessage("Organization domain already exists. Please try a different one.");
            return;
        } else {
            setOrgCreateData(data);
        }
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value
        const domain = name.toLowerCase().replace(/\s+/g, "-")
        form.setValue("domain", domain)
      }

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <Image
                    src={logoDark}
                    className="h-16 w-auto hidden dark:block"
                    alt={"Sourcebot logo"}
                    priority={true}
                />
                <Image
                    src={logoLight}
                    className="h-16 w-auto block dark:hidden"
                    alt={"Sourcebot logo"}
                    priority={true}
                />
            </div>
            <h1 className="text-2xl font-bold">Let&apos;s create your organization</h1>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(submitOrgInfoForm)} className="space-y-8">
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
                                        <Input placeholder="aperature-labs" {...field} className="w-1/2" />
                                        <span className="ml-2">.sourcebot.dev</span>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {errorMessage && <p className="text-red-500">{errorMessage}</p>}
                    <div className="flex justify-center">
                        <Button type="submit">Create</Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
