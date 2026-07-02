import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Inline notice shown on settings surfaces whose controls are superseded when
 * SCIM provisioning is enabled (the IdP owns membership). The message is passed
 * as children so each surface can phrase it for its own controls.
 */
export const ManagedByScimNotice = ({ children }: { children: ReactNode }) => (
    <Alert className="items-center p-4">
        <Info className="w-4 h-4 text-muted-foreground" />
        <AlertDescription>{children}</AlertDescription>
    </Alert>
);
