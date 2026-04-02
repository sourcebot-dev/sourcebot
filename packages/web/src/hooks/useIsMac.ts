'use client';

import { useState, useEffect } from 'react';

export function useIsMac(): boolean {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(/Mac OS X/.test(navigator.userAgent));
    }, []);

    return isMac;
}
