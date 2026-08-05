import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VerifyForm } from "./verifyForm";

export default async function VerifyPage() {
    const session = await auth();
    if (session) {
        return redirect("/");
    }

    return <VerifyForm />;
}
