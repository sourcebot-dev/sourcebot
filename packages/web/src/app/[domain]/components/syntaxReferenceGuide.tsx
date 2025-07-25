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
                className="max-h-[80vh] max-w-[700px] overflow-scroll"
            >
                <DialogHeader>
                    <DialogTitle>Syntax Reference Guide</DialogTitle>
                    <DialogDescription className="text-sm text-foreground">
                        Queries consist of space-seperated regular expressions. Wrapping expressions in <CodeSnippet>{`""`}</CodeSnippet> combines them. By default, a file must have at least one match for each expression to be included.
                    </DialogDescription>
                </DialogHeader>
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
                            <TableCell className="py-2"><CodeSnippet>foo bar</CodeSnippet></TableCell>
                            <TableCell className="py-2">Match files with regex <CodeSnippet>/foo/</CodeSnippet> <b>and</b> <CodeSnippet>/bar/</CodeSnippet></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet>{`"foo bar"`}</CodeSnippet></TableCell>
                            <TableCell className="py-2">Match files with regex <CodeSnippet>/foo bar/</CodeSnippet></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <Separator className="my-2"/>
                <p className="text-sm">
                    {`Multiple expressions can be or'd together with `}<CodeSnippet>or</CodeSnippet>, negated with <CodeSnippet>-</CodeSnippet>, or grouped with <CodeSnippet>()</CodeSnippet>.
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
                            <TableCell className="py-2">Match files with regex <CodeSnippet>/foo/</CodeSnippet> <b>or</b> <CodeSnippet>/bar/</CodeSnippet></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet>foo -bar</CodeSnippet></TableCell>
                            <TableCell className="py-2">Match files with regex <CodeSnippet>/foo/</CodeSnippet> but <b>not</b> <CodeSnippet>/bar/</CodeSnippet></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="py-2"><CodeSnippet>foo (bar <Highlight>or</Highlight> baz)</CodeSnippet></TableCell>
                            <TableCell className="py-2">Match files with regex <CodeSnippet>/foo/</CodeSnippet> <b>and</b> either <CodeSnippet>/bar/</CodeSnippet> <b>or</b> <CodeSnippet>/baz/</CodeSnippet></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <Separator className="my-2"/>
                <p className="text-sm">
                    Expressions can be prefixed with certain keywords to modify search behavior. Some keywords can be negated using the <CodeSnippet>-</CodeSnippet> prefix.
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
