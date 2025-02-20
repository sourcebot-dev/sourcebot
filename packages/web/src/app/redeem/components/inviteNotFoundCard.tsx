import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";


export const InviteNotFoundCard = async () => {
    const session = await auth();

    return (
        <Card className="flex flex-col items-center justify-center max-w-md text-center p-12">
            <SourcebotLogo
                className="h-16 w-auto mx-auto mb-2"
                size="small"
            />
            <h2 className="text-2xl font-bold">Invite not found</h2>
            <p className="mt-5">
                The invite you are trying to redeem has already been used, expired, or does not exist.
            </p>
            <div className="flex flex-col items-center gap-2 mt-8">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={session?.user.image ?? placeholderAvatar.src} />
                </Avatar>
                <p className="text-sm text-muted-foreground">
                    Logged in as <strong>{session?.user?.email}</strong>
                </p>
            </div>
        </Card>
    );
}