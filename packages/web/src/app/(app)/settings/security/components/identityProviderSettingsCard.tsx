import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "@/app/(app)/settings/components/settingsCard";
import { getAuthProviderInfo, cn } from "@/lib/utils";
import { IdentityProvider } from "@/auth";

interface IdentityProviderSettingsCardProps {
    provider: IdentityProvider;
}

export function IdentityProviderSettingsCard({ provider }: IdentityProviderSettingsCardProps) {
    const providerInfo = getAuthProviderInfo(provider.type);
    const name = provider.displayName ?? providerInfo.displayName;

    return (
        <SettingsCard>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                        {providerInfo.icon && (
                            <Image
                                src={providerInfo.icon.src}
                                alt={name}
                                className={cn("w-5 h-5", providerInfo.icon.className)}
                            />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        {provider.issuerUrl && (
                            <p className="text-xs text-muted-foreground truncate">{provider.issuerUrl}</p>
                        )}
                    </div>
                </div>
                <Badge className="flex-shrink-0">Configured</Badge>
            </div>
        </SettingsCard>
    );
}
