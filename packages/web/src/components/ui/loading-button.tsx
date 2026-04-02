'use client';

// @note: this is not a original Shadcn component.

import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import React from "react";

export interface LoadingButtonProps extends ButtonProps {
    loading?: boolean;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(({ children, loading, ...props }, ref) => {
    return (
        <Button
            {...props}
            ref={ref}
            disabled={loading || props.disabled}
        >
            {loading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {children}
        </Button>
    )
});

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };