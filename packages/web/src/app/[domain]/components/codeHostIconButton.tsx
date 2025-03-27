'use client';

import { Button } from "@/components/ui/button";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface CodeHostIconButton {
    name: string;
    logo: { src: string, className?: string };
    onClick: () => void;
}

export const CodeHostIconButton = ({
    name,
    logo,
    onClick,
}: CodeHostIconButton) => {
    const captureEvent = useCaptureEvent();
    return (
        <Button
            className="flex flex-col items-center justify-center p-4 w-24 h-24 cursor-pointer gap-2"
            variant="outline"
            onClick={() => {
                captureEvent('wa_connect_code_host_button_pressed', {
                    name,
                })
                onClick();
            }}
        >
            <Image src={logo.src} alt={name} className={cn("w-8 h-8", logo.className)} />
            <p className="text-sm font-medium">{name}</p>
        </Button>
    )
}