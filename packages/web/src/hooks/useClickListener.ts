'use client';

import { useEffect } from "react";

export const useClickListener = (elementSelector: string, onClick: (elementClicked: boolean) => void) => {
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const element = document.querySelector(elementSelector);

            if (element) {
                const isElementClicked = element.contains(event.target as Node);
                onClick(isElementClicked);
            }
        };

        document.addEventListener('click', handleClick);

        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, [onClick, elementSelector]);

    return null;
}