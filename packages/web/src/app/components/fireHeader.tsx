import { Repository } from "@/lib/types";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { LaptopIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";

interface FileHeaderProps {
    repo?: Repository;
    fileName: string;
    fileNameHighlightRange?: {
        from: number;
        to: number;
    }
    branchDisplayName?: string;
    branchDisplayTitle?: string;
}

export const FileHeader = ({
    repo,
    fileName,
    fileNameHighlightRange,
    branchDisplayName,
    branchDisplayTitle,
}: FileHeaderProps) => {

    const info = getRepoCodeHostInfo(repo);

    return (
        <div className="flex flex-row gap-2 items-center w-full overflow-hidden">
            {info?.icon ? (
                <Image
                    src={info.icon}
                    alt={info.costHostName}
                    className={`w-4 h-4 ${info.iconClassName}`}
                />
            ): (
                <LaptopIcon className="w-4 h-4" />
            )}
            <Link
                className={clsx("font-medium", {
                    "cursor-pointer hover:underline": info?.repoLink,
                })}
                href={info?.repoLink ?? ""}
            >
                {info?.displayName}
            </Link>
            {branchDisplayName && (
                <span
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5"
                    title={branchDisplayTitle}
                >
                    {`@ ${branchDisplayName}`}
                </span>
            )}
            <span>·</span>
            <div className="flex-1 flex items-center overflow-hidden">
                <span className="inline-block w-full truncate-start font-mono text-sm">
                    {!fileNameHighlightRange ?
                        fileName
                        : (
                            <>
                                {fileName.slice(0, fileNameHighlightRange.from)}
                                <span className="bg-yellow-200 dark:bg-blue-700">
                                    {fileName.slice(fileNameHighlightRange.from, fileNameHighlightRange.to)}
                                </span>
                                {fileName.slice(fileNameHighlightRange.to)}
                            </>
                        )}
                </span>
            </div>
        </div>
    )
}