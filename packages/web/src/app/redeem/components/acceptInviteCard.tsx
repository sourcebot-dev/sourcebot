'use client';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import Link from "next/link";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { redeemInvite } from "@/actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";

interface AcceptInviteCardProps {
    inviteId: string;
    orgName: string;
    orgDomain: string;
    orgImageUrl?: string;
    host: {
        name?: string;
        email: string;
        avatarUrl?: string;
    };
    recipient: {
        name?: string;
        email: string;
    };
}

export const AcceptInviteCard = ({ inviteId, orgName, orgDomain, orgImageUrl, host, recipient }: AcceptInviteCardProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const onRedeemInvite = useCallback(() => {
        setIsLoading(true);
        redeemInvite(inviteId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to redeem invite with error: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: `✅ You are now a member of the ${orgName} organization.`,
                    });
                    router.push(`/${orgDomain}`);
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [inviteId, orgDomain, orgName, router, toast]);

    return (
        <Card className="p-12 max-w-lg">
            <CardHeader className="text-center">
                <SourcebotLogo
                    className="h-16 w-auto mx-auto mb-2"
                    size="large"
                />
                <CardTitle className="font-medium text-2xl">
                    Join <strong>{orgName}</strong>
                </CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
                <p>
                    Hello {recipient.name?.split(' ')[0] ?? recipient.email},
                </p>
                <p className="mt-5">
                    <InvitedByText email={host.email} name={host.name} /> invited you to join the <strong>{orgName}</strong> organization.
                </p>
                <div className="flex fex-row items-center justify-center gap-2 mt-12">
                    <Avatar className="w-14 h-14">
                        <AvatarImage src={host.avatarUrl ?? placeholderAvatar.src} />
                    </Avatar>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <Avatar className="w-14 h-14">
                        <AvatarImage src={orgImageUrl ?? placeholderAvatar.src} />
                    </Avatar>
                </div>
                <Button
                    className="mt-12 mx-auto w-full"
                    disabled={isLoading}
                    onClick={onRedeemInvite}
                >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Accept Invite
                </Button>
            </CardContent>
        </Card>
    )
}

const InvitedByText = ({ email, name }: { email: string, name?: string }) => {
    const emailElement = <Link href={`mailto:${email}`} className="text-blue-500 hover:text-blue-600">
        {email}
    </Link>;

    if (name) {
        const firstName = name.split(' ')[0];
        return <span><strong>{firstName}</strong> ({emailElement})</span>;
    }

    return emailElement;
}