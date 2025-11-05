import { Badge } from "@/components/ui/badge";

interface ProviderBadgeProps {
    required: boolean;
}

export function ProviderBadge({ required }: ProviderBadgeProps) {
    return (
        <Badge
            variant={required ? "default" : "secondary"}
            className="text-xs font-medium"
        >
            {required ? "Required" : "Optional"}
        </Badge>
    );
}
