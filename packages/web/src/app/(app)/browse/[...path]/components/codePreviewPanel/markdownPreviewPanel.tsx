import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Image, Link as MdastLink, Root, Text } from "mdast";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { getBrowsePath } from "../../../hooks/utils";

interface MarkdownPreviewPanelProps {
    source: string;
    repoName: string;
    revisionName?: string;
    path: string;
}

const URL_WITH_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

const isExternalUrl = (url: string): boolean => URL_WITH_SCHEME_RE.test(url) || url.startsWith('//');

const splitUrl = (url: string) => {
    const hashIndex = url.indexOf('#');
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
    const queryIndex = beforeHash.indexOf('?');

    return {
        path: queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex),
        query: queryIndex === -1 ? '' : beforeHash.slice(queryIndex),
        hash,
    };
};

const decodeUrlPath = (urlPath: string): string | undefined => {
    try {
        return decodeURIComponent(urlPath);
    } catch {
        return undefined;
    }
};

const resolveRepoRelativePath = (currentFilePath: string, urlPath: string): string => {
    const baseSegments = currentFilePath.split('/').slice(0, -1);
    const candidateSegments = urlPath.startsWith('/')
        ? urlPath.split('/')
        : [...baseSegments, ...urlPath.split('/')];
    const resolvedSegments: string[] = [];

    for (const segment of candidateSegments) {
        if (!segment || segment === '.') {
            continue;
        }

        if (segment === '..') {
            resolvedSegments.pop();
            continue;
        }

        resolvedSegments.push(segment);
    }

    return resolvedSegments.join('/');
};

const getRelativeBrowseHref = ({ repoName, revisionName, currentPath, href }: {
    repoName: string;
    revisionName?: string;
    currentPath: string;
    href: string;
}): string | undefined => {
    if (!href || href.startsWith('#') || isExternalUrl(href)) {
        return undefined;
    }

    const { path, query, hash } = splitUrl(href);
    const decodedPath = decodeUrlPath(path);

    if (decodedPath === undefined) {
        return undefined;
    }

    const pathType = decodedPath.endsWith('/') ? 'tree' : 'blob';
    const resolvedPath = resolveRepoRelativePath(currentPath, decodedPath);

    if (!resolvedPath && pathType !== 'tree') {
        return undefined;
    }

    return `${getBrowsePath({
        repoName,
        revisionName,
        path: resolvedPath,
        pathType,
    })}${query}${hash}`;
};

const getImageLabel = (alt?: string | null): string => alt ? `Image: ${alt}` : 'Image';

const remarkImageLinks = () => {
    return (tree: Root) => {
        visit(tree, 'image', (node: Image, index, parent) => {
            if (index === undefined || !parent || !('children' in parent)) {
                return;
            }

            const textNode: Text = {
                type: 'text',
                value: getImageLabel(node.alt),
            };

            if (!node.url || parent.type === 'link') {
                parent.children[index] = textNode;
                return;
            }

            const linkNode: MdastLink = {
                type: 'link',
                url: node.url,
                title: node.title,
                children: [textNode],
            };

            parent.children[index] = linkNode;
        });
    };
};

export const MarkdownPreviewPanel = ({ source, repoName, revisionName, path }: MarkdownPreviewPanelProps) => {
    return (
        <ScrollArea className="h-full w-full">
            <article
                className={cn(
                    "prose prose-sm dark:prose-invert max-w-none px-6 py-5",
                    "prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground",
                    "prose-headings:mt-6 prose-p:my-3 prose-img:rounded-md prose-img:my-4 prose-hr:my-6",
                    "prose-headings:font-semibold prose-li:marker:text-foreground",
                    "prose-a:text-link prose-a:no-underline hover:prose-a:underline",
                    "prose-code:before:content-none prose-code:after:content-none",
                    "prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs",
                    "prose-pre:bg-muted prose-pre:text-foreground prose-pre:leading-snug",
                    "[&>*:first-child]:mt-0"
                )}
            >
                <Markdown
                    remarkPlugins={[remarkGfm, remarkImageLinks]}
                    components={{
                        a: ({ href, children, node: _node, ...props }) => {
                            const browseHref = typeof href === 'string'
                                ? getRelativeBrowseHref({ repoName, revisionName, currentPath: path, href })
                                : undefined;

                            if (browseHref) {
                                return <Link href={browseHref}>{children}</Link>;
                            }

                            return <a href={href} {...props}>{children}</a>;
                        },
                    }}
                >
                    {source}
                </Markdown>
            </article>
        </ScrollArea>
    );
}
