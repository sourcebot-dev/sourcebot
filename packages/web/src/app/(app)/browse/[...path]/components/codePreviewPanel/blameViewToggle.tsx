'use client';

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";

interface BlameViewToggleProps {
    repoName: string;
    revisionName?: string;
    path: string;
    blame: boolean;
}

export const BlameViewToggle = ({ repoName, revisionName, path, blame }: BlameViewToggleProps) => {
    const router = useRouter();

    const handleValueChange = (value: string) => {
        // Radix calls onValueChange with an empty string when the user clicks
        // the already-selected item (would deselect). Ignore that — we want
        // exactly one of Code / Blame to always be selected.
        if (!value) {
            return;
        }
        router.push(getBrowsePath({
            repoName,
            revisionName,
            path,
            pathType: 'blob',
            blame: value === 'blame',
        }));
    };

    // The Toggle "default" size is icon-sized (h-7 w-7 p-0) since it's the
    // codebase's only declared size. `w-auto min-w-0 px-3` lets the items size
    // to their text. The remaining classes turn the two items into a connected
    // segmented control: gap-0 on the group removes the flex gap, rounded-*-none
    // squares off the inner corners, and -ml-px pulls the second item over so
    // its left border overlaps the first item's right border (no double seam).
    const baseItemClass = "w-auto min-w-0 px-3";

    return (
        <ToggleGroup
            type="single"
            value={blame ? 'blame' : 'code'}
            onValueChange={handleValueChange}
            variant="outline"
            className="gap-0"
        >
            <ToggleGroupItem
                value="code"
                aria-label="View source code"
                className={`${baseItemClass} rounded-r-none`}
            >
                Code
            </ToggleGroupItem>
            <ToggleGroupItem
                value="blame"
                aria-label="View blame"
                className={`${baseItemClass} rounded-l-none -ml-px`}
            >
                Blame
            </ToggleGroupItem>
        </ToggleGroup>
    );
};
