import { getAuthProviderInfo } from "@/lib/utils";
import { ProviderIcon } from "./providerIcon";
import { ProviderBadge } from "./providerBadge";

interface ProviderInfoProps {
    providerId: string;
    required: boolean;
    showBadge?: boolean;
}

export function ProviderInfo({ providerId, required, showBadge = true }: ProviderInfoProps) {
    const providerInfo = getAuthProviderInfo(providerId);

    return (
        <>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                    {providerInfo.displayName}
                </span>
                {showBadge && <ProviderBadge required={required} />}
            </div>
        </>
    );
}
