'use client';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import Cookies from "js-cookie";
import { encryptValue } from "@/actions";

export const MAGIC_LINK_ONBOARDING_COOKIE_NAME = "magic_link_onboarding_params"
const MAGIC_LINK_ONBOARDING_COOKIE_EXPIRATION_DAYS = 7


const magicLinkSchema = z.object({
    email: z.string().email(),
});

interface MagicLinkFormProps {
    callbackUrl?: string;
}   

export const MagicLinkForm = ({ callbackUrl }: MagicLinkFormProps) => {
    const captureEvent = useCaptureEvent();
    const [isLoading, setIsLoading] = useState(false);

    const magicLinkForm = useForm<z.infer<typeof magicLinkSchema>>({
        resolver: zodResolver(magicLinkSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSignIn = async (values: z.infer<typeof magicLinkSchema>) => {
        setIsLoading(true);
        captureEvent("wa_login_with_magic_link", {});

        const { iv: encryptedIv, encryptedData: encryptedEmail } = await encryptValue(values.email);
        Cookies.set(MAGIC_LINK_ONBOARDING_COOKIE_NAME, `${encryptedIv}:${encryptedEmail}`, { expires: MAGIC_LINK_ONBOARDING_COOKIE_EXPIRATION_DAYS});

        signIn("nodemailer", { email: values.email, redirectTo: callbackUrl ?? "/" })
            .finally(() => {
                Cookies.remove(MAGIC_LINK_ONBOARDING_COOKIE_NAME);
                setIsLoading(false);
            });
    }

    return (
        <Form
            {...magicLinkForm}
        >
            <form
                onSubmit={magicLinkForm.handleSubmit(onSignIn)}
                className="w-full"
            >
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
                <Button
                    type="submit"
                    className="w-full"
                    variant="outline"
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : ""}
                    Sign in with magic link
                </Button>
            </form>
        </Form>
    )
}