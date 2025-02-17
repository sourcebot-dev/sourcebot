'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { verifyCredentialsRequestSchema } from "@/lib/schemas";

interface CredentialsFormProps {
    callbackUrl?: string;
}

export const CredentialsForm = ({ callbackUrl }: CredentialsFormProps) => {
    const form = useForm<z.infer<typeof verifyCredentialsRequestSchema>>({
        resolver: zodResolver(verifyCredentialsRequestSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = (values: z.infer<typeof verifyCredentialsRequestSchema>) => {
        signIn("credentials", {
            email: values.email,
            password: values.password,
            redirectTo: callbackUrl ?? "/"
        });
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full"
            >
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="mb-4">
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem className="mb-8">
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full"
                    variant="outline"
                >
                    Sign in with credentials
                </Button>
            </form>
        </Form>
    );
} 