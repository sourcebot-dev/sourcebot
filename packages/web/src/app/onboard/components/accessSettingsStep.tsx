import Link from "next/link";
import { Button } from "@/components/ui/button";
import { __unsafePrisma } from "@/prisma";
import { createInviteLink } from "@/lib/utils";
import { env, isMemberApprovalRequired } from "@sourcebot/shared";
import { MemberApprovalRequiredSettingsCard } from "@/app/(app)/settings/security/components/memberApprovalRequiredSettingsCard";
import { InviteLinkEnabledSettingsCard } from "@/app/(app)/settings/security/components/inviteLinkEnabledSettingsCard";
import { Org } from "@sourcebot/db";

interface AccessSettingsStepProps {
    nextStep: number;
    org: Org;
}

export async function AccessSettingsStep({ nextStep, org }: AccessSettingsStepProps) {
    const inviteLink = createInviteLink(env.AUTH_URL, org.inviteLinkId);

    return (
        <div className="space-y-6">
            <MemberApprovalRequiredSettingsCard
                memberApprovalRequired={isMemberApprovalRequired(org)}
            />
            <InviteLinkEnabledSettingsCard
                inviteLinkEnabled={org.inviteLinkEnabled}
                inviteLink={inviteLink}
            />
            <Button asChild className="w-full">
                <Link href={`/onboard?step=${nextStep}`}>Continue →</Link>
            </Button>
        </div>
    );
}
