'use client';

// @note: this is not a original Shadcn component.

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import React from "react";

export interface LoadingButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    asChild?: boolean;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
    ({ children, loading, className, variant, size, asChild = false, disabled, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        const isDisabled = loading || disabled;

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={isDisabled}
                aria-disabled={isDisabled}
                {...props}
            >
                <>
                    {loading && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {children}
                </>
            </Comp>
        );
    }
);

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };