"use client"

import { Button } from "@/components/ui/button"

export function EnterpriseContactUsButton() {
    const handleContactUs = () => {
        window.location.href = "mailto:team@sourcebot.dev?subject=Enterprise%20Pricing%20Inquiry"
    }

    return (
        <Button className="w-full" onClick={handleContactUs}>
            Contact Us
        </Button>
    )
}