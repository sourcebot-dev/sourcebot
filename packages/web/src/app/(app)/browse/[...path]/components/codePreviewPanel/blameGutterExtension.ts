import { Decoration, DecorationSet, EditorView, gutter, gutterLineClass, GutterMarker } from "@codemirror/view";
import { EditorState, Extension, Prec, Range as CMRange, RangeSet, StateField } from "@codemirror/state";
import { formatDistanceToNowStrict } from "date-fns";
import type { FileBlameResponse } from "@/features/git";
import { cn } from "@/lib/utils";
import { BLAME_AGE_BG_CLASSES, computeAgeBucket } from "./blameAgeColors";

type LineEntry = {
    hash: string;
    // Set only on the first line of a contiguous range; null on continuation
    // lines so they render as empty filler cells.
    message: string | null;
    date: string | null;
    authorEmail: string | null;
    // Pointer to the prior commit in the blame walk, used by the reblame
    // button. Absent when the commit introduced the lines.
    previous: { hash: string; path: string } | null;
    // True for first-line cells except line 1 of the file, so the divider
    // border doesn't render at the very top of the gutter.
    showStartBorder: boolean;
    // 0..9 bucket for the age-of-commit indicator stripe. Same value across
    // every line of a region (continuation lines included).
    ageBucket: number;
};

// @see: https://lucide.dev/icons/file-stack
const FILE_STACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-stack-icon lucide-file-stack"><path d="M11 21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1"/><path d="M16 16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1"/><path d="M21 6a2 2 0 0 0-.586-1.414l-2-2A2 2 0 0 0 17 2h-3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1z"/></svg>'


const buildCellDom = (
    entry: LineEntry,
    onCommitClick: (hash: string) => void,
    onReblameClick: (previous: { hash: string; path: string }) => void,
): HTMLElement => {
    const cell = document.createElement('div');
    // `relative` so the absolutely-positioned age stripe inside has a
    // positioning context. The stripe is a child <div> rather than a
    // border-left because tailwind-merge collapses any same-group border-color
    // class (e.g. `border-border` on the region divider) with the per-side
    // amber color, dropping the stripe on first-line cells.
    cell.className = cn(
        'relative flex items-start h-full pl-2 pr-2 overflow-hidden text-xs text-muted-foreground',
        entry.showStartBorder && 'border-t border-border',
    );

    const stripe = document.createElement('div');
    stripe.className = cn(
        'absolute inset-y-0 left-0 w-0.5',
        BLAME_AGE_BG_CLASSES[entry.ageBucket],
    );
    cell.appendChild(stripe);

    if (entry.message === null || entry.date === null) {
        // Continuation line — empty cell with a non-breaking space so the row
        // still occupies its full line height.
        cell.appendChild(document.createTextNode(' '));
        return cell;
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'flex-shrink-0 w-24 truncate opacity-70 mr-1';
    dateEl.textContent = formatDistanceToNowStrict(new Date(entry.date), { addSuffix: true });
    cell.appendChild(dateEl);

    // Avatar replicates UserAvatar's structure inline. Goes through the same
    // /api/avatar resolver so profile pictures and identicons share the same
    // browser cache as the rest of the app.
    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'relative flex h-4 w-4 shrink-0 overflow-hidden rounded-full bg-muted mr-2';
    if (entry.authorEmail) {
        const avatarImg = document.createElement('img');
        avatarImg.className = 'aspect-square h-full w-full';
        avatarImg.src = `/api/avatar?email=${encodeURIComponent(entry.authorEmail)}`;
        avatarImg.alt = '';
        avatarWrap.appendChild(avatarImg);
    }
    cell.appendChild(avatarWrap);

    const messageEl = document.createElement('button');
    messageEl.type = 'button';
    messageEl.className = 'flex-1 min-w-0 truncate text-left bg-transparent border-0 p-0 m-0 font-[inherit] text-inherit cursor-pointer hover:text-foreground hover:underline';
    messageEl.textContent = entry.message;
    messageEl.addEventListener('click', () => onCommitClick(entry.hash));
    cell.appendChild(messageEl);

    if (entry.previous) {
        const previous = entry.previous;
        const reblameBtn = document.createElement('button');
        reblameBtn.type = 'button';
        reblameBtn.title = `Blame prior to ${previous.hash.slice(0, 7)}`;
        reblameBtn.className = 'flex-shrink-0 ml-1 p-0.5 bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground';
        reblameBtn.innerHTML = FILE_STACK_SVG;
        reblameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onReblameClick(previous);
        });
        cell.appendChild(reblameBtn);
    }

    return cell;
};

class BlameMarker extends GutterMarker {
    constructor(
        readonly entry: LineEntry,
        readonly onCommitClick: (hash: string) => void,
        readonly onReblameClick: (previous: { hash: string; path: string }) => void,
    ) {
        super();
    }

    eq(other: GutterMarker): boolean {
        if (!(other instanceof BlameMarker)) {
            return false;
        }
        const a = this.entry;
        const b = other.entry;
        return (
            a.hash === b.hash &&
            a.message === b.message &&
            a.date === b.date &&
            a.authorEmail === b.authorEmail &&
            a.showStartBorder === b.showStartBorder &&
            a.ageBucket === b.ageBucket &&
            a.previous?.hash === b.previous?.hash &&
            a.previous?.path === b.previous?.path
        );
    }

    toDOM(): HTMLElement {
        return buildCellDom(this.entry, this.onCommitClick, this.onReblameClick);
    }
}

// Decoration applied to source-area lines that share the active commit, and a
// matching gutter marker so the blame column gets the same highlight.
const activeLineDecoration = Decoration.line({
    attributes: { class: 'cm-blame-active-line' },
});
const activeGutterMarker = new (class extends GutterMarker {
    elementClass = 'cm-blame-active-line';
})();

const computeActive = (
    state: EditorState,
    lineIndex: Map<number, LineEntry>,
    commitToLines: Map<string, number[]>,
): { decorations: DecorationSet; gutterMarkers: RangeSet<GutterMarker> } => {
    const cursorLine = state.doc.lineAt(state.selection.main.head).number;
    const activeHash = lineIndex.get(cursorLine)?.hash;
    if (!activeHash) {
        return { decorations: Decoration.none, gutterMarkers: RangeSet.empty };
    }

    const lines = commitToLines.get(activeHash) ?? [];
    const decoRanges: CMRange<Decoration>[] = [];
    const markerRanges: CMRange<GutterMarker>[] = [];

    for (const lineNumber of lines) {
        if (lineNumber > state.doc.lines) {
            continue;
        }
        const line = state.doc.line(lineNumber);
        decoRanges.push(activeLineDecoration.range(line.from));
        markerRanges.push(activeGutterMarker.range(line.from));
    }

    return {
        decorations: Decoration.set(decoRanges),
        gutterMarkers: RangeSet.of(markerRanges),
    };
};

const buildLineIndex = (blame: FileBlameResponse): Map<number, LineEntry> => {
    // Compute the file's overall date range so each commit's age can be
    // mapped to a 0..9 bucket. We assume blame.commits' `date` fields are
    // ISO 8601 strings.
    const dateMs = Object.values(blame.commits)
        .map(c => new Date(c.date).getTime())
        .filter(t => Number.isFinite(t));
    const oldestMs = dateMs.length > 0 ? Math.min(...dateMs) : 0;
    const newestMs = dateMs.length > 0 ? Math.max(...dateMs) : 0;

    // Per-commit bucket cache so every line of a region gets the same value
    // (and we don't recompute for each line).
    const bucketByHash = new Map<string, number>();
    for (const [hash, commit] of Object.entries(blame.commits)) {
        bucketByHash.set(hash, computeAgeBucket(commit.date, oldestMs, newestMs));
    }

    const index = new Map<number, LineEntry>();
    for (const range of blame.ranges) {
        const commit = blame.commits[range.hash];
        const ageBucket = bucketByHash.get(range.hash) ?? 0;
        for (let i = 0; i < range.lineCount; i++) {
            const lineNumber = range.startLine + i;
            const isFirstLineOfRange = i === 0;
            const showStartBorder = isFirstLineOfRange && lineNumber > 1;
            if (isFirstLineOfRange && commit) {
                index.set(lineNumber, {
                    hash: range.hash,
                    message: commit.message,
                    date: commit.date,
                    authorEmail: commit.authorEmail,
                    previous: commit.previous ?? null,
                    showStartBorder,
                    ageBucket,
                });
            } else {
                index.set(lineNumber, {
                    hash: range.hash,
                    message: null,
                    date: null,
                    authorEmail: null,
                    previous: null,
                    showStartBorder,
                    ageBucket,
                });
            }
        }
    }
    return index;
};

const blameTheme = EditorView.theme({
    '.cm-blame-gutter': {
        width: '400px',
        backgroundColor: 'var(--background)',
        borderRight: '1px solid var(--border)',
        userSelect: 'none',
    },
    '.cm-blame-active-line': {
        backgroundColor: 'var(--accent)',
    },
});

export const blameGutterExtension = (
    blame: FileBlameResponse,
    onCommitClick: (hash: string) => void,
    onReblameClick: (previous: { hash: string; path: string }) => void,
): Extension => {
    const lineIndex = buildLineIndex(blame);

    // Reverse index: commit hash → ascending list of line numbers attributed to
    // that commit. Used to highlight every line of the active commit when the
    // cursor is on one of them. Cheap to build (one pass over lineIndex, which
    // is itself iterated in line order).
    const commitToLines = new Map<string, number[]>();
    for (const [lineNumber, entry] of lineIndex) {
        const existing = commitToLines.get(entry.hash);
        if (existing) {
            existing.push(lineNumber);
        } else {
            commitToLines.set(entry.hash, [lineNumber]);
        }
    }

    const activeBlameField = StateField.define<{
        decorations: DecorationSet;
        gutterMarkers: RangeSet<GutterMarker>;
    }>({
        create: state => computeActive(state, lineIndex, commitToLines),
        update(value, tr) {
            if (tr.docChanged || tr.selection) {
                return computeActive(tr.state, lineIndex, commitToLines);
            }
            return value;
        },
        provide: f => [
            EditorView.decorations.from(f, v => v.decorations),
            gutterLineClass.from(f, v => v.gutterMarkers),
        ],
    });

    return [
        activeBlameField,
        // Bump precedence so this gutter is registered before lineNumbers() from
        // basicSetup, placing the blame column to the left of line numbers.
        Prec.high(gutter({
            class: 'cm-blame-gutter',
            lineMarker(view, blockInfo) {
                const lineNumber = view.state.doc.lineAt(blockInfo.from).number;
                const entry = lineIndex.get(lineNumber);
                if (!entry) {
                    return null;
                }
                return new BlameMarker(entry, onCommitClick, onReblameClick);
            },
        })),
        blameTheme,
    ];
};
