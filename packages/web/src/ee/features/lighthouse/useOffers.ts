'use client';

import { getOffers } from "@/app/api/(client)/client";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export const useOffers = () => {
    return useQuery({
        queryKey: ["offers"],
        queryFn: async () => unwrapServiceError(getOffers()),
    });
}