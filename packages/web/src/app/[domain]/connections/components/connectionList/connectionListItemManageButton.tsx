'use client'

import { Button } from "@/components/ui/button";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface ConnectionListItemManageButtonProps {
    id: string;
}

export const ConnectionListItemManageButton = ({
    id
}: ConnectionListItemManageButtonProps) => {
    const captureEvent = useCaptureEvent()

    return (
        <Button
            variant="outline"
            size={"sm"}
            className="ml-4"
            onClick={() => {
                captureEvent('wa_connection_list_item_manage_pressed', {})
                window.location.href = `connections/${id}`
            }}
        >
            Manage
        </Button>
    );
};
