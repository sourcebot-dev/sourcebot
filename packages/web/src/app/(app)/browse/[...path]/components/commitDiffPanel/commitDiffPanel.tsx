'use client';

import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { useCallback, useMemo, useState } from "react";
import CodeMirrorMerge, { CodeMirrorMergeRef } from "react-codemirror-merge";

interface CommitDiffPanelProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
}

const DEMO_BEFORE = `
import { readFile } from 'fs/promises';
import path from 'path';

const CONFIG_PATH = './config.json';
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;

interface Config {
    name: string;
    version: string;
    timeout?: number;
}

async function loadConfig(): Promise<Config> {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
}

function logInfo(message: string) {
    console.log(\`[INFO] \${message}\`);
}

function logError(message: string) {
    console.error(\`[ERROR] \${message}\`);
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return \`\${minutes}m \${seconds % 60}s\`;
}

async function fetchWithRetry(url: string): Promise<Response> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fetch(url);
        } catch (err) {
            if (attempt === MAX_RETRIES - 1) {
                throw err;
            }
        }
    }
    throw new Error('unreachable');
}

function isValidName(name: string): boolean {
    return name.length > 0 && name.length < 100;
}

function sanitize(input: string): string {
    return input.trim().toLowerCase();
}

async function main() {
    const config = await loadConfig();
    logInfo(\`Loaded config for \${config.name}\`);

    const start = Date.now();
    const response = await fetchWithRetry('https://example.com');
    const duration = Date.now() - start;
    logInfo(\`Request took \${formatDuration(duration)}\`);
}

main().catch(logError);
`.trim();

const DEMO_AFTER = `
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const CONFIG_PATH = './config.json';
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 5;

interface Config {
    name: string;
    version: string;
    timeout?: number;
    debug?: boolean;
}

async function loadConfig(): Promise<Config> {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
}

function logInfo(message: string) {
    console.log(\`[INFO] \${message}\`);
}

function logError(message: string) {
    console.error(\`[ERROR] \${message}\`);
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return \`\${minutes}m \${seconds % 60}s\`;
}

async function fetchWithRetry(url: string, timeoutMs = DEFAULT_TIMEOUT): Promise<Response> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const result = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            return result;
        } catch (err) {
            if (attempt === MAX_RETRIES - 1) {
                throw err;
            }
        }
    }
    throw new Error('unreachable');
}

function isValidName(name: string): boolean {
    return name.length > 0 && name.length < 100;
}

function sanitize(input: string): string {
    return input.trim().toLowerCase();
}

async function main() {
    const config = await loadConfig();
    logInfo(\`Loaded config for \${config.name} v\${config.version}\`);

    const start = Date.now();
    const response = await fetchWithRetry('https://example.com', config.timeout);
    const duration = Date.now() - start;
    logInfo(\`Request took \${formatDuration(duration)}\`);

    if (config.debug) {
        await writeFile('./last-response.txt', await response.text());
    }
}

main().catch(logError);
`.trim();


export const CommitDiffPanel = ({ repoName, revisionName, commitSha, path }: CommitDiffPanelProps) => {
    const theme = useCodeMirrorTheme();
    const [originalView, setOriginalView] = useState<EditorView>();
    const [modifiedView, setModifiedView] = useState<EditorView>();

    const captureRef = useCallback((node: CodeMirrorMergeRef | null) => {
        setOriginalView(node?.view?.a);
        setModifiedView(node?.view?.b);
    }, []);

    return (
        <div className="flex flex-col gap-4 p-6 h-full overflow-auto">
            <div className="text-sm text-muted-foreground space-y-1">
                <div>repo: <code>{repoName}</code></div>
                <div>revision: <code>{revisionName ?? '(none)'}</code></div>
                <div>commit: <code>{commitSha}</code></div>
                <div>file: <code>{path || '(none)'}</code></div>
            </div>
            <div className="border rounded">
                <CodeMirrorMerge
                    ref={captureRef}
                    orientation="a-b"
                    theme={theme}
                    highlightChanges={false}
                    gutter={true}
                    destroyRerender={false}
                    collapseUnchanged={{
                        margin: 5
                    }}
                >
                    <CodeDiff side="original" value={DEMO_BEFORE} language="JavaScript" view={originalView} />
                    <CodeDiff side="modified" value={DEMO_AFTER} language="JavaScript" view={modifiedView} />
                </CodeMirrorMerge>
            </div>
        </div>
    );
};

interface CodeDiffProps {
    side: 'original' | 'modified';
    value: string;
    language: string;
    view: EditorView | undefined;
}

const CodeDiff = ({ side, value, language, view }: CodeDiffProps) => {
    const languageExtension = useCodeMirrorLanguageExtension(language, view);

    const extensions = useMemo(() => [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        lineNumbers(),
        languageExtension,
    ], [languageExtension]);

    const Editor = side === 'original' ? CodeMirrorMerge.Original : CodeMirrorMerge.Modified;
    return <Editor
        value={value}
        extensions={extensions}
    />;
};
