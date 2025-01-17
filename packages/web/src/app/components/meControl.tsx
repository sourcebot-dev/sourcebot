'use client';
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";


export const MeControl = () => {
    const { data: session } = useSession();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {session?.user?.image ? (
                    <Avatar>
                        <AvatarImage
                            src={session.user.image}
                        />
                    </Avatar>
                ) : (
                    <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                    </Button>
                )}
            </DropdownMenuTrigger>
        </DropdownMenu>
    )

}