import type { Commit } from "@/features/git";

export type Author = { name: string; email: string };

export const parseCoAuthors = (body: string): Author[] => {
    const coAuthors: Author[] = [];
    const regex = /^co-authored-by:\s*(.+?)\s*<(.+?)>\s*$/gim;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
        coAuthors.push({ name: match[1].trim(), email: match[2].trim() });
    }
    return coAuthors;
};

export const getCommitAuthors = (commit: Commit): Author[] => {
    const all: Author[] = [
        { name: commit.authorName, email: commit.authorEmail },
        ...parseCoAuthors(commit.body),
    ];
    const seen = new Set<string>();
    return all.filter((a) => {
        const key = a.email.toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

export const formatAuthorsText = (authors: Author[]): string => {
    if (authors.length === 1) {
        return authors[0].name;
    }
    if (authors.length === 2) {
        return `${authors[0].name} and ${authors[1].name}`;
    }
    const others = authors.length - 2;
    return `${authors[0].name}, ${authors[1].name}, and ${others} other${others > 1 ? "s" : ""}`;
};
