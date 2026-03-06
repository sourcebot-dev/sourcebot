'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ClientIconProps {
    name: string;
    logoUri?: string | null;
}

export function ClientIcon({ name, logoUri }: ClientIconProps) {
    const [failed, setFailed] = useState(false);

    if (logoUri && !failed) {
        return (
            <Image
                src={logoUri}
                alt={name}
                width={56}
                height={56}
                className="shrink-0 w-14 h-14 rounded-xl object-cover"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div className="shrink-0 w-14 h-14 rounded-xl border border-border bg-muted flex items-center justify-center text-xl font-bold text-foreground">
            {name.charAt(0).toUpperCase()}
        </div>
    );
}
