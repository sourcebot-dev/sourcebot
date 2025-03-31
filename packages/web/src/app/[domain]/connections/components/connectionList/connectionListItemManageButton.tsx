'use client'

import { Button } from "@/components/ui/button";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";

interface ConnectionListItemManageButtonProps {
    id: string;
    disabled: boolean;
}

export const ConnectionListItemManageButton = ({
    id,
    disabled,
}: ConnectionListItemManageButtonProps) => {
    const captureEvent = useCaptureEvent()
    const router = useRouter();
    const domain = useDomain();

    return (
        <Button
            variant="outline"
            size={"sm"}
            className="ml-4"
            disabled={disabled}
            onClick={() => {
                if (!disabled) {
                    captureEvent('wa_connection_list_item_manage_pressed', {})
                    router.push(`/${domain}/connections/${id}`)
                }
            }}
        >
            Manage
        </Button>
    );
};
