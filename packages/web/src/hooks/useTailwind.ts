'use client';

import { useMemo } from "react";
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../tailwind.config';

export const useTailwind = () => {
    const tailwind = useMemo(() => {
        return resolveConfig(tailwindConfig);
    }, [tailwindConfig]);

    return tailwind;
}