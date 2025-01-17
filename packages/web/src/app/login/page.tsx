import { providerMap, signIn } from "@/auth"
import { AuthError } from "next-auth"
import { redirect } from "next/navigation"
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import githubLogo from "@/public/github.svg";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const SIGNIN_ERROR_URL = "/login";

export default async function Login(props: {
    searchParams: { callbackUrl: string | undefined }
}) {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <div className="flex flex-col items-center border p-16 rounded-lg gap-6">
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
                {
                    Object.values(providerMap)
                        .map((provider) => {
                            if (provider.id === "github") {
                                return {
                                    provider,
                                    logo: githubLogo,
                                }
                            }

                            return { provider }
                        })
                        .map(({ provider, logo }) => (
                            <form
                                key={provider.id}
                                action={async () => {
                                    "use server"
                                    try {
                                        await signIn(provider.id, {
                                            redirectTo: props.searchParams?.callbackUrl ?? "",
                                        })
                                    } catch (error) {
                                        // Signin can fail for a number of reasons, such as the user
                                        // not existing, or the user not having the correct role.
                                        // In some cases, you may want to redirect to a custom error
                                        if (error instanceof AuthError) {
                                            return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`)
                                        }

                                        // Otherwise if a redirects happens Next.js can handle it
                                        // so you can just re-thrown the error and let Next.js handle it.
                                        // Docs:
                                        // https://nextjs.org/docs/app/api-reference/functions/redirect#server-component
                                        throw error
                                    }
                                }}
                            >
                                <Button
                                    type="submit"
                                >
                                    {logo && (
                                        <Image
                                            src={logo}
                                            alt={provider.name}
                                            className="w-5 h-5 invert dark:invert-0 mr-2"
                                        />
                                    )}
                                    Sign in with {provider.name}
                                </Button>
                            </form>
                        ))
                    }
            </div>
        </div>
    )
}
