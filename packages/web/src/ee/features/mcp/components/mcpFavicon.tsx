'use client';

import { Plug } from "lucide-react";
import { useState } from "react";

interface McpFaviconProps {
    faviconUrl: string | undefined;
    className?: string;
}

export const McpFavicon = ({ faviconUrl, className = "w-4 h-4" }: McpFaviconProps) => {
    const [failed, setFailed] = useState(false);
    if (faviconUrl && !failed) {
        return (
            <img
                src={faviconUrl}
                onError={() => setFailed(true)}
                className={`${className} flex-shrink-0`}
                alt=""
            />
        );
    }
    return <Plug className={`${className} flex-shrink-0`} />;
};