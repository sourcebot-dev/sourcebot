'use client';

import Link from "next/link";
import { ComponentPropsWithoutRef, useState } from "react";

type HoverPrefetchLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'prefetch'>;

// Drop-in replacement for next/link that defers prefetching until the user
// hovers, instead of prefetching on viewport entry. Useful in long lists where
// the default behavior would fire many prefetches up-front.
export const HoverPrefetchLink = ({
    onMouseEnter,
    ...props
}: HoverPrefetchLinkProps) => {
    const [active, setActive] = useState(false);

    return (
        <Link
            {...props}
            prefetch={active ? true : false}
            onMouseEnter={(event) => {
                setActive(true);
                onMouseEnter?.(event);
            }}
        />
    );
};
