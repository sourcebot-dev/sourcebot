import { cn } from "@/lib/utils"

export const CodeSnippet = ({ children, className, title, renderNewlines = false }: { children: React.ReactNode, className?: string, title?: string, renderNewlines?: boolean }) => {
    return (
        <code
            className={cn("bg-gray-100 dark:bg-gray-700 w-fit rounded-md px-2 py-0.5 font-medium font-mono", className)}
            title={title}
        >
            {renderNewlines ? <pre>{children}</pre> : children}
        </code>
    )
}