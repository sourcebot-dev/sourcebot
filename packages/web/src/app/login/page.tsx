import { auth } from "@/auth";
import { LoginForm } from "./components/loginForm";
import { redirect } from "next/navigation";

interface LoginProps {
    searchParams: {
        callbackUrl?: string;
        error?: string;
    }
}

export default async function Login({ searchParams }: LoginProps) {
    const session = await auth();
    if (session) {
        return redirect("/");
    }

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <LoginForm callbackUrl={searchParams.callbackUrl} error={searchParams.error} />
        </div>
    )
}
