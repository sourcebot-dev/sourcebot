import { LoginForm } from "./components/loginForm";

interface LoginProps {
    searchParams: {
        callbackUrl?: string;
        error?: string;
    }
}

export default async function Login({ searchParams }: LoginProps) {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <LoginForm callbackUrl={searchParams.callbackUrl} error={searchParams.error} />
        </div>
    )
}
