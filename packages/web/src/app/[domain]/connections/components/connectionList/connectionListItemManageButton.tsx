'use client'

import { Button } from "@/components/ui/button";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";

interface ConnectionListItemManageButtonProps {
    id: string;
    isManageable: boolean;
}

export const ConnectionListItemManageButton = ({
    id,
    isManageable,
}: ConnectionListItemManageButtonProps) => {
    const captureEvent = useCaptureEvent()
    const router = useRouter();
    const domain = useDomain();

    return (
        <Button
            variant="outline"
            size={"sm"}
            className="ml-4"
            disabled={!isManageable}
            onClick={() => {
                if (isManageable) {
                    captureEvent('wa_connection_list_item_manage_pressed', {})
                    router.push(`/${domain}/connections/${id}`)
                }
            }}
        >
            Manage
        </Button>
    );
};
