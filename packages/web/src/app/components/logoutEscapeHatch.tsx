import { LogOutIcon } from "lucide-react";
import { signOut } from "@/auth";
interface LogoutEscapeHatchProps {
    className?: string;
}

export const LogoutEscapeHatch = ({
    className,
}: LogoutEscapeHatchProps) => {
    return (
        <div className={className}>
            <form
                action={async () => {
                    "use server";
                    await signOut({
                        redirectTo: "/login",
                    });
                }}
            >
                <button
                    type="submit"
                    className="flex flex-row items-center gap-2 text-sm text-muted-foreground cursor-pointer"
                >
                    <LogOutIcon className="w-4 h-4" />
                    Log out
                </button>
            </form>
        </div>
    );
}