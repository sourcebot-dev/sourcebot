import Image from "next/image";
import { LibraryBigIcon, Code, Layers } from "lucide-react";
import { cn, getCodeHostIcon } from "@/lib/utils";

export const SearchScopeInfoCard = () => {
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                <Layers className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-popover-foreground">Search Context</h4>
            </div>
            <div className="text-sm text-popover-foreground leading-relaxed">
                When asking Sourcebot a question, you can select one or more search contexts to constrain its scope. There
                are two different types of search contexts:
                <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                        {(() => {
                            const githubIcon = getCodeHostIcon("github");
                            return githubIcon ? (
                                <Image
                                    src={githubIcon.src}
                                    alt="GitHub icon"
                                    width={16}
                                    height={16}
                                    className={cn("h-4 w-4 flex-shrink-0", githubIcon.className)}
                                />
                            ) : (
                                <Code className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            );
                        })()}
                        <span><strong>Repository</strong>: A single repository, indicated by the code host icon.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <LibraryBigIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span><strong>Set</strong>: A set of repositories, indicated by the library icon.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}; 