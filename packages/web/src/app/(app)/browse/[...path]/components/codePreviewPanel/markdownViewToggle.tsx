import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getBrowsePath, type BlobViewMode } from "../../../hooks/utils";
import Link from "next/link";

interface MarkdownViewToggleProps {
    repoName: string;
    revisionName?: string;
    path: string;
    viewMode: BlobViewMode;
}

export const MarkdownViewToggle = ({ repoName, revisionName, path, viewMode }: MarkdownViewToggleProps) => {
    const baseItemClass = "w-auto min-w-0 px-3";

    return (
        <ToggleGroup
            type="single"
            value={viewMode}
            variant="outline"
            className="gap-0"
        >
            <ToggleGroupItem
                value="rendered"
                aria-label="Preview rendered markdown"
                className={`${baseItemClass} rounded-r-none`}
                asChild
            >
                <Link
                    href={getBrowsePath({
                        repoName,
                        revisionName,
                        path,
                        pathType: 'blob',
                        viewMode: 'rendered',
                    })}
                >
                    Preview
                </Link>
            </ToggleGroupItem>
            <ToggleGroupItem
                value="source"
                aria-label="View raw markdown source"
                className={`${baseItemClass} rounded-l-none -ml-px`}
                asChild
            >
                <Link
                    href={getBrowsePath({
                        repoName,
                        revisionName,
                        path,
                        pathType: 'blob',
                        viewMode: 'source',
                    })}
                >
                    Source
                </Link>
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
