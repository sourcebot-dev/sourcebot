import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, CSSProperties, FC } from "react";

interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
    shimmerWidth?: number;
}

// Classic "shine sweep" animated text (magicui AnimatedShinyText). A bright
// band moves across the text via an animated background-position on a
// background-clipped gradient. See the `shiny-text` keyframes in
// tailwind.config.ts.
export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
    children,
    className,
    shimmerWidth = 100,
    ...props
}) => {
    return (
        <span
            style={
                {
                    "--shiny-width": `${shimmerWidth}px`,
                } as CSSProperties
            }
            className={cn(
                // The base text must be semi-transparent so the (opaque) shine
                // band, painted behind the glyphs via bg-clip-text, shows
                // through as it sweeps across.
                "text-neutral-600/70 dark:text-neutral-400/70",
                "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
                "bg-gradient-to-r from-transparent via-neutral-900/80 via-50% to-transparent dark:via-neutral-100/80",
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
};
