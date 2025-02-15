import { LoginForm } from "./components/loginForm";
import { Suspense } from "react";

export default async function Login() {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    )
}
