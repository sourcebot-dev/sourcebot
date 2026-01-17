'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useSyntaxGuide } from "./syntaxGuideProvider";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { ExternalLinkIcon, RegexIcon } from "lucide-react";

const LINGUIST_LINK = "https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml";
const CTAGS_LINK = "https://ctags.io/";

export const SyntaxReferenceGuide = () => {
    const { isOpen, onOpenChanged } = useSyntaxGuide();
    const previousFocusedElement = useRef<HTMLElement | null>(null);

    const openDialog = useCallback(() => {
        previousFocusedElement.current = document.activeElement as HTMLElement;
        onOpenChanged(true);
    }, [onOpenChanged]);

    const closeDialog = useCallback(() => {
        onOpenChanged(false);

        // @note: Without requestAnimationFrame, focus was not being returned
        // to codemirror elements for some reason.
        requestAnimationFrame(() => {
            previousFocusedElement.current?.focus();
        });
    }, [onOpenChanged]);

    const handleOpenChange = useCallback((isOpen: boolean) => {
        if (isOpen) {
            openDialog();
        } else {
            closeDialog();
        }
    }, [closeDialog, openDialog]);

    useHotkeys("mod+/", (event) => {
        event.preventDefault();
        handleOpenChange(!isOpen);
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open Syntax Reference Guide",
    });

    return (
        <Dialog
            open={isOpen}
            onOpenChange={handleOpenChange}
        >
            <DialogContent
                className="max-h-[80vh] max-w-[700px] overflow-scroll gap-2"
            >
                <DialogHeader>
                    <DialogTitle>Syntax Reference Guide <Link href="https://docs.sourcebot.dev/docs/features/search/syntax-reference"><ExternalLinkIcon className="inline w-4 h-4 ml-1 mb-1 text-muted-foreground cursor-pointer" /></Link></DialogTitle>
                    <DialogDescription className="text-sm text-foreground">
                        Queries consist of space-separated search patterns that are matched against file contents. A file must have at least one match for each expression to be included. Queries can optionally contain search filters to further refine the search results.
                    </DialogDescription>
                </DialogHeader>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">Keyword search (default)</h3>
                    <p className="text-sm mb-2 mt-0">
                        Keyword search matches search patterns exactly in file contents. Wrapping search patterns in <CodeSnippet>{`""`}</CodeSnippet> combines them as a single expression.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">Example</TableHead>
                                <TableHead className="py-2">Explanation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing the keyword <CodeSnippet>foo</CodeSnippet></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing both <CodeSnippet>foo</CodeSnippet> <b>and</b> <CodeSnippet>bar</CodeSnippet></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`"foo bar"`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing the phrase <CodeSnippet>foo bar</CodeSnippet></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{'"foo \\"bar\\""'}</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing <CodeSnippet>foo &quot;bar&quot;</CodeSnippet> exactly (escaped quotes)</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">Regex search</h3>
                    <p className="text-sm mb-2 mt-0">
                        Toggle the <RegexIcon className="inline w-4 h-4 align-middle mx-0.5 border rounded px-0.5 py-0.5" /> button to interpret search patterns as regular expressions.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">Example</TableHead>
                                <TableHead className="py-2">Explanation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files with regex <CodeSnippet>/foo/</CodeSnippet></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo.*bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files with regex <CodeSnippet>/foo.*bar/</CodeSnippet> (foo followed by any characters, then bar)</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`^function\\s+\\w+`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files with regex <CodeSnippet>/^function\s+\w+/</CodeSnippet> (function at start of line, followed by whitespace and word characters)</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>{`"foo bar"`}</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files with regex <CodeSnippet>/foo bar/</CodeSnippet>. Quotes are not matched.</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">Search filters</h3>
                    <p className="text-sm mb-2 mt-0">
                        Search queries (keyword or regex) can include multiple search filters to further refine the search results. Some filters can be negated using the <CodeSnippet>-</CodeSnippet> prefix.
                    </p>

                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="py-2">Prefix</TableHead>
                            <TableHead className="py-2">Description</TableHead>
                            <TableHead className="py-2 w-[175px]">Example</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>file:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">Filter results from filepaths that match the regex. By default all files are searched.</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title="Filter results to filepaths that match regex /README/"
                                    >
                                        <Highlight>file:</Highlight>README
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title="Filter results to filepaths that match regex /my file/"
                                    >
                                        <Highlight>file:</Highlight>{`"my file"`}
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title="Ignore results from filepaths match regex /test\.ts$/"
                                    >
                                        <Highlight>-file:</Highlight>test\.ts$
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>repo:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">Filter results from repos that match the regex. By default all repos are searched.</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title="Filter results to repos that match regex /linux/"
                                    >
                                        <Highlight>repo:</Highlight>linux
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title="Ignore results from repos that match regex /^web\/.*/"
                                    >
                                        <Highlight>-repo:</Highlight>^web/.*
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>rev:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">Filter results from a specific branch or tag. By default <b>only</b> the default branch is searched.</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title="Filter results to branches that match regex /beta/"
                                    >
                                        <Highlight>rev:</Highlight>beta
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>lang:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">Filter results by language (as defined by <Link className="text-blue-500" href={LINGUIST_LINK}>linguist</Link>). By default all languages are searched.</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title="Filter results to TypeScript files"
                                    >
                                        <Highlight>lang:</Highlight>TypeScript
                                    </CodeSnippet>
                                    <CodeSnippet
                                        title="Ignore results from YAML files"
                                    >
                                        <Highlight>-lang:</Highlight>YAML
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet><Highlight>sym:</Highlight></CodeSnippet></TableCell>
                            <TableCell className="py-2">Match symbol definitions created by <Link className="text-blue-500" href={CTAGS_LINK}>universal ctags</Link> at index time.</TableCell>
                            <TableCell className="py-2">
                                <div className="flex flex-col gap-1">
                                    <CodeSnippet
                                        title="Filter results to symbols that match regex /\bmain\b/"
                                    >
                                        <Highlight>sym:</Highlight>\bmain\b
                                    </CodeSnippet>
                                </div>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>

                <Separator className="my-4"/>

                <div>
                    <h3 className="text-lg font-semibold mt-4 mb-0">Boolean operators &amp; grouping</h3>
                    <p className="text-sm mb-2 mt-0">
                        By default, space-seperated expressions are and&apos;d together. Using the <CodeSnippet>or</CodeSnippet> keyword as well as parantheses <CodeSnippet>()</CodeSnippet> can be used to create more complex boolean logic. Parantheses can be negated using the <CodeSnippet>-</CodeSnippet> prefix.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="py-2">Example</TableHead>
                                <TableHead className="py-2">Explanation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo <Highlight>or</Highlight> bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing <CodeSnippet>foo</CodeSnippet> <b>or</b> <CodeSnippet>bar</CodeSnippet></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>foo (bar <Highlight>or</Highlight> baz)</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing <CodeSnippet>foo</CodeSnippet> <b>and</b> either <CodeSnippet>bar</CodeSnippet> <b>or</b> <CodeSnippet>baz</CodeSnippet>.</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="py-2"><CodeSnippet>-(foo) bar</CodeSnippet></TableCell>
                                <TableCell className="py-2">Match files containing <CodeSnippet>bar</CodeSnippet> <b>and not</b> <CodeSnippet>foo</CodeSnippet>.</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const Highlight = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-highlight">
            {children}
        </span>
    )
}
