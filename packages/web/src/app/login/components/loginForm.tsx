'use client';

import { Button } from "@/components/ui/button";
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import googleLogo from "@/public/google.svg";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Fragment, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn, getCodeHostIcon } from "@/lib/utils";
import { MagicLinkForm } from "./magicLinkForm";
import { CredentialsForm } from "./credentialsForm";

interface LoginFormProps {
    callbackUrl?: string;
    error?: string;
    enabledMethods: {
        github: boolean;
        google: boolean;
        magicLink: boolean;
        credentials: boolean;
    }
}

export const LoginForm = ({ callbackUrl, error, enabledMethods }: LoginFormProps) => {
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
        <div className="flex flex-col items-center justify-center">
            <div className="mb-6 flex flex-col items-center">
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
                <h2 className="text-lg font-bold">Sign in to your account</h2>
            </div>
            <Card className="flex flex-col items-center border p-12 rounded-lg gap-6 w-[500px] bg-background">
                {error && (
                    <div className="text-sm text-destructive text-center text-wrap border p-2 rounded-md border-destructive">
                        {errorMessage}
                    </div>
                )}
                <DividerSet
                    children={[
                        ...(enabledMethods.github || enabledMethods.google ? [
                            <>
                                {enabledMethods.github && (
                                    <ProviderButton
                                        name="GitHub"
                                        logo={getCodeHostIcon("github")!}
                                        onClick={() => {
                                            onSignInWithOauth("github")
                                        }}
                                    />
                                )}
                                {enabledMethods.google && (
                                    <ProviderButton
                                        name="Google"
                                        logo={{ src: googleLogo }}
                                        onClick={() => {
                                            onSignInWithOauth("google")
                                        }}
                                    />
                                )}
                            </>
                        ] : []),
                        ...(enabledMethods.magicLink ? [
                            <MagicLinkForm callbackUrl={callbackUrl} />
                        ] : []),
                        ...(enabledMethods.credentials ? [
                            <CredentialsForm callbackUrl={callbackUrl} />
                        ] : [])
                    ]}
                />
            </Card>
        </div>
    )
}

const ProviderButton = ({
    name,
    logo,
    onClick,
    className,
}: {
    name: string;
    logo: { src: string, className?: string };
    onClick: () => void;
    className?: string;
}) => {
    return (
        <Button
            onClick={onClick}
            className={cn("w-full", className)}
            variant="outline"
        >
            {logo && <Image src={logo.src} alt={name} className={cn("w-5 h-5 mr-2", logo.className)} />}
            Sign in with {name}
        </Button>
    )
}

const DividerSet = ({ children }: { children: React.ReactNode[] }) => {
    return children.map((child, index) => {
        return (
            <Fragment key={index}>
                {child}
                {index < children.length - 1 && <Divider />}
            </Fragment>
        )
    })
}

const Divider = ({ className }: { className?: string }) => {
    return (
        <div className={cn("flex items-center w-full gap-4", className)}>
            <div className="h-[1px] flex-1 bg-border" />
            <span className="text-muted-foreground text-sm">or</span>
            <div className="h-[1px] flex-1 bg-border" />
        </div>
    )
}