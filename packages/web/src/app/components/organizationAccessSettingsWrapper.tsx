"use client"

import { useState } from "react"
import { MemberApprovalRequiredToggle } from "./memberApprovalRequiredToggle"
import { InviteLinkToggle } from "./inviteLinkToggle"

interface OrganizationAccessSettingsWrapperProps {
    memberApprovalRequired: boolean
    inviteLinkEnabled: boolean
    inviteLink: string | null
    forceMemberApprovalRequired?: string
}

export function OrganizationAccessSettingsWrapper({ 
    memberApprovalRequired, 
    inviteLinkEnabled, 
    inviteLink,
    forceMemberApprovalRequired
}: OrganizationAccessSettingsWrapperProps) {
    const [showInviteLink, setShowInviteLink] = useState(memberApprovalRequired)
    
    const handleMemberApprovalToggle = (checked: boolean) => {
        setShowInviteLink(checked)
    }

    return (
        <>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden max-h-96 opacity-100`}>
                <MemberApprovalRequiredToggle 
                    memberApprovalRequired={memberApprovalRequired}
                    onToggleChange={handleMemberApprovalToggle}
                    forceMemberApprovalRequired={forceMemberApprovalRequired}
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
        </>
    )
}