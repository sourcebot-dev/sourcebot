"use client"

import { useState } from "react"
import { AnonymousAccessToggle } from "./anonymousAccessToggle"
import { MemberApprovalRequiredToggle } from "./memberApprovalRequiredToggle"
import { InviteLinkToggle } from "./inviteLinkToggle"

interface OrganizationAccessSettingsProps {
    anonymousAccessEnabled: boolean
    memberApprovalRequired: boolean
    inviteLinkEnabled: boolean
    inviteLink: string | null
}

export function OrganizationAccessSettings({ 
    anonymousAccessEnabled,
    memberApprovalRequired, 
    inviteLinkEnabled, 
    inviteLink 
}: OrganizationAccessSettingsProps) {
    const [showInviteLink, setShowInviteLink] = useState(memberApprovalRequired && !anonymousAccessEnabled)
    const handleMemberApprovalToggle = (checked: boolean) => {
        setShowInviteLink(checked)
    }

    return (
        <div className="space-y-6">
            <AnonymousAccessToggle 
                anonymousAccessEnabled={anonymousAccessEnabled}
            />

            <div className={`transition-all duration-300 ease-in-out overflow-hidden max-h-96 opacity-100`}>
                <MemberApprovalRequiredToggle 
                    memberApprovalRequired={memberApprovalRequired}
                    onToggleChange={handleMemberApprovalToggle}
                />
            </div>
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                showInviteLink 
                    ? 'max-h-96 opacity-100' 
                    : 'max-h-0 opacity-0 pointer-events-none'
            }`}>
                <InviteLinkToggle 
                    inviteLinkEnabled={inviteLinkEnabled} 
                    inviteLink={inviteLink} 
                />
            </div>
        </div>
    )
}