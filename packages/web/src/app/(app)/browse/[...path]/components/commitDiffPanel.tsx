interface CommitDiffPanelProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
}

export const CommitDiffPanel = ({ repoName, revisionName, commitSha, path }: CommitDiffPanelProps) => {
    return (
        <div className="flex flex-col gap-2 p-6">
            <h1 className="text-xl font-semibold">Hello World</h1>
            <div className="text-sm text-muted-foreground space-y-1">
                <div>repo: <code>{repoName}</code></div>
                <div>revision: <code>{revisionName ?? '(none)'}</code></div>
                <div>commit: <code>{commitSha}</code></div>
                <div>file: <code>{path || '(none)'}</code></div>
            </div>
        </div>
    );
};
