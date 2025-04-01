'use client';

import { useParams } from "next/navigation";

export const useDomain = () => {
    const { domain } = useParams<{ domain: string }>();
    return domain;
}