import { cn } from "@/lib/utils"

export const CodeSnippet = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string }) => {
    return (
        <code
            className={cn("bg-gray-100 dark:bg-gray-700 w-fit rounded-md px-2 py-0.5 font-medium font-mono", className)}
            title={title}
        >
            {children}
        </code>
    )
}