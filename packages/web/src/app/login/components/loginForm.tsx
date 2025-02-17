'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import githubLogo from "@/public/github.svg";
import googleLogo from "@/public/google.svg";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useCallback, useMemo } from "react";
import { verifyCredentialsRequestSchema } from "@/lib/schemas";

interface LoginFormProps {
    callbackUrl?: string;
    error?: string;
}

const magicLinkSchema = z.object({
    email: z.string().email(),
})

export const LoginForm = ({ callbackUrl, error }: LoginFormProps) => {
    const emailPasswordForm = useForm<z.infer<typeof verifyCredentialsRequestSchema>>({
        resolver: zodResolver(verifyCredentialsRequestSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const magicLinkForm = useForm<z.infer<typeof magicLinkSchema>>({
        resolver: zodResolver(magicLinkSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSignInWithEmailPassword = (values: z.infer<typeof verifyCredentialsRequestSchema>) => {
        signIn("credentials", {
            email: values.email,
            password: values.password,
            redirectTo: callbackUrl ?? "/"
        });
    }

    const onSignInWithMagicLink = (values: z.infer<typeof magicLinkSchema>) => {
        signIn("nodemailer", { email: values.email, redirectTo: callbackUrl ?? "/" });
    }

    const onSignInWithOauth = useCallback((provider: string) => {
        signIn(provider, { redirectTo: callbackUrl ?? "/" });
    }, [callbackUrl]);

    const errorMessage = useMemo(() => {
        if (!error) {
            return "";
        }
        switch (error) {
            case "CredentialsSignin":
                return "Invalid email or password. Please try again.";
            case "OAuthAccountNotLinked":
                return "This email is already associated with a different sign-in method.";
            default:
                return "An error occurred during authentication. Please try again.";
        }
    }, [error]);

    return (
        <div className="flex flex-col items-center border p-16 rounded-lg gap-6 w-[500px]">
            {error && (
                <div className="text-sm text-destructive text-center text-wrap border p-2 rounded-md border-destructive">
                    {errorMessage}
                </div>
            )}
            <div>
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
            <ProviderButton
                name="GitHub"
                logo={githubLogo}
                onClick={() => {
                    onSignInWithOauth("github")
                }}
            />
            <ProviderButton
                name="Google"
                logo={googleLogo}
                onClick={() => {
                    onSignInWithOauth("google")
                }}
            />
            <div className="flex items-center w-full gap-4">
                <div className="h-[1px] flex-1 bg-border" />
                <span className="text-muted-foreground text-sm">or</span>
                <div className="h-[1px] flex-1 bg-border" />
            </div>
            <div className="flex flex-col w-60">
                <Form {...magicLinkForm}>
                    <form onSubmit={magicLinkForm.handleSubmit(onSignInWithMagicLink)}>
                        <FormField
                            control={magicLinkForm.control}
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
                        <Button type="submit" className="w-full">
                            Sign in
                        </Button>
                    </form>
                </Form>
                <Form {...emailPasswordForm}>
                    <form onSubmit={emailPasswordForm.handleSubmit(onSignInWithEmailPassword)}>
                        <FormField
                            control={emailPasswordForm.control}
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
                            control={emailPasswordForm.control}
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
                        <Button type="submit" className="w-full">
                            Sign in
                        </Button>
                    </form>
                </Form>
            </div>
        </div >
    )
}

const ProviderButton = ({
    name,
    logo,
    onClick,
}: {
    name: string;
    logo: string;
    onClick: () => void;
}) => {
    return (
        <Button onClick={onClick}>
            {logo && <Image src={logo} alt={name} className="w-5 h-5 invert dark:invert-0 mr-2" />}
            Sign in with {name}
        </Button>
    )
}