import { FileDiff } from "@/features/git";

const TOTAL_SQUARES = 5;

// Count `+`/`-` lines across all hunks in a file.
export const computeChangeCounts = (file: FileDiff) => {
    let additions = 0;
    let deletions = 0;
    for (const hunk of file.hunks) {
        for (const raw of hunk.body.split('\n')) {
            if (raw.startsWith('+')) {
                additions++;
            } else if (raw.startsWith('-')) {
                deletions++;
            }
        }
    }
    return { additions, deletions };
};

// Sum line-level change counts across multiple files.
export const computeTotalChangeCounts = (files: FileDiff[]) => {
    let additions = 0;
    let deletions = 0;
    for (const file of files) {
        const counts = computeChangeCounts(file);
        additions += counts.additions;
        deletions += counts.deletions;
    }
    return { additions, deletions };
};

// Map a total change count to a number of filled squares (0–5) using a
// log-ish scale so tiny diffs still show one square and huge diffs cap out.
// Mirrors GitHub's diffstat indicator behavior.
const filledSquaresForTotal = (total: number): number => {
    if (total === 0) {
        return 0;
    }
    if (total < 5) {
        return 1;
    }
    if (total < 10) {
        return 2;
    }
    if (total < 30) {
        return 3;
    }
    if (total < 100) {
        return 4;
    }
    return 5;
};

interface DiffStatProps {
    additions: number;
    deletions: number;
}

export const DiffStat = ({ additions, deletions }: DiffStatProps) => {
    const total = additions + deletions;

    // Skip rendering when there are no line-level changes (e.g. pure renames).
    if (total === 0) {
        return null;
    }

    const filled = filledSquaresForTotal(total);
    const greenCount = Math.round((filled * additions) / total);
    const redCount = filled - greenCount;
    const emptyCount = TOTAL_SQUARES - filled;

    return (
        <div
            className="flex flex-row items-center gap-2 text-xs flex-shrink-0 font-mono"
            title={`${additions} additions, ${deletions} deletions`}
        >
            {additions > 0 && (
                <span className="text-green-700 dark:text-green-400">+{additions}</span>
            )}
            {deletions > 0 && (
                <span className="text-red-700 dark:text-red-400">-{deletions}</span>
            )}
            <div className="flex flex-row gap-px">
                {Array.from({ length: greenCount }).map((_, i) => (
                    <span key={`g-${i}`} className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-[1px]" />
                ))}
                {Array.from({ length: redCount }).map((_, i) => (
                    <span key={`r-${i}`} className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-[1px]" />
                ))}
                {Array.from({ length: emptyCount }).map((_, i) => (
                    <span key={`e-${i}`} className="w-2 h-2 bg-border rounded-[1px]" />
                ))}
            </div>
        </div>
    );
};
