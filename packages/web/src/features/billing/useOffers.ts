'use client';

import { getOffers } from "@/app/api/(client)/client";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export const useOffers = (params?: {
    retry: number,
}) => {
    return useQuery({
        queryKey: ["offers"],
        queryFn: async () => unwrapServiceError(getOffers()),
        retry: params?.retry,
        refetchOnWindowFocus: false
    });
}