import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Phone } from "lucide-react"

const BOOK_A_CALL_BASE_URL = "https://calendly.com/michael-sourcebot/sourcebot-demo"

interface BookACallSidebarButtonProps {
    // When the deployment is the public "ask GitHub" app, attribute bookings
    // to `public-app` so they can be told apart from self-hosted instances.
    isAskGhEnabled: boolean
}

export function BookACallSidebarButton({ isAskGhEnabled }: BookACallSidebarButtonProps) {
    const utmSource = isAskGhEnabled ? "public-app" : "app"
    const href = `${BOOK_A_CALL_BASE_URL}?utm_source=${utmSource}`

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Book a Call">
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-4 w-4" />
                        <span>Book a Call</span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
