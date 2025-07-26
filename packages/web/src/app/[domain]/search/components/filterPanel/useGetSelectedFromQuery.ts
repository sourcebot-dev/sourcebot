'use client';

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

// Helper to parse query params into sets
export const useGetSelectedFromQuery = () => {
    const searchParams = useSearchParams();
    const getSelectedFromQuery = useCallback((param: string): Set<string> => {
        const value = searchParams.get(param);
        return value ? new Set(value.split(',')) : new Set();
    }, [searchParams]);

    return {
        getSelectedFromQuery,
    }
}
