import { SourcebotLogo } from "@/app/components/sourcebotLogo";

export default function VerifyPage() {

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <SourcebotLogo
                className="mb-2 h-16"
                size="small"
            />
            <h1 className="text-2xl font-bold mb-2">Verify your email</h1>
            <p className="text-sm text-muted-foreground">
                {`We've sent a magic link to your email. Please check your inbox.`}
            </p>
        </div>
    )
}