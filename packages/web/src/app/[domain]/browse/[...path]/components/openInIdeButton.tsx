"use client";

import { Code2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OpenInIdeButtonProps {
    path: string;
    line?: number;
    column?: number;
}

// Hardcoded base path for initial implementation
const REPO_BASE_PATH = "/Users/brendan/sourcebot";

export const OpenInIdeButton = ({
    path,
    line = 1,
    column = 1,
}: OpenInIdeButtonProps) => {
    // Construct the full file path
    const fullPath = `${REPO_BASE_PATH}/${path}`;

    // VS Code deep link format: vscode://file/absolute/path/to/file:line:column
    const vscodeUrl = `vscode://file${fullPath}:${line}:${column}`;

    return (
        <Button variant="ghost" size="sm" className="px-2 py-0.5 h-8" asChild>
            <Link href={vscodeUrl}>
                <Code2Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Open in VS Code</span>
            </Link>
        </Button>
    );
};
