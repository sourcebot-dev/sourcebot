import { cn, CodeHostType, getCodeHostIcon } from "@/lib/utils";
import { LibraryBigIcon } from "lucide-react";
import Image from "next/image";
import { SearchScope } from "../types";

interface SearchScopeIconProps {
    searchScope: SearchScope;
    className?: string;
}

export const SearchScopeIcon = ({ searchScope, className = "h-4 w-4" }: SearchScopeIconProps) => {
    if (searchScope.type === 'reposet') {
        return <LibraryBigIcon className={cn(className, "text-muted-foreground flex-shrink-0")} />;
    } else {
        // Render code host icon for repos
        const codeHostIcon = getCodeHostIcon(searchScope.codeHostType as CodeHostType);
        const size = className.includes('h-3') ? 12 : 16;
        return (
            <Image
                src={codeHostIcon.src}
                alt={`${searchScope.codeHostType} icon`}
                width={size}
                height={size}
                className={cn(className, "flex-shrink-0", codeHostIcon.className)}
            />
        );
    }
}; 