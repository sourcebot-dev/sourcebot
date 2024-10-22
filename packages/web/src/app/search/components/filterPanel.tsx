'use client';

import { Input } from "@/components/ui/input";
import { SearchResultFile } from "@/lib/types";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { FileIcon } from "@radix-ui/react-icons";
import clsx from "clsx";

interface FilePanelProps {
    fileMatches: SearchResultFile[];
}

type Entry = {
    icon?: string;
    iconAltText?: string;
    count: number;
    isSelected: boolean;
}

export const FilterPanel = ({
    fileMatches,
}: FilePanelProps) => {
    const [repos, setRepos] = useState<Record<string, Entry>>({});

    useEffect(() => {
        const _repos = fileMatches
            .map((fileMatch) => fileMatch.Repository)
            .reduce((repos, repoName) => {
                if (!repos[repoName]) {
                    const info = getRepoCodeHostInfo(repoName);
                    repos[repoName] = {
                        icon: info?.icon,
                        iconAltText: info?.costHostName,
                        count: 0,
                        isSelected: false,
                    };
                }
                repos[repoName].count += 1;
                return repos;
            }, {} as Record<string, Entry>);
        
        setRepos(_repos);
    }, [fileMatches, setRepos]);

    const onEntryClicked = useCallback((name: string) => {
        setRepos((repos) => ({
            ...repos,
            [name]: {
                ...repos[name],
                isSelected: !repos[name].isSelected,
            },
        }));
    }, []);

    return (
        <div className="p-3 flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Filter Results</h1>

            <div className="flex flex-col gap-2 p-1">
                <h2 className="text-md">By Repository</h2>
                <Input
                    placeholder="Filter repositories"
                    className="h-8"
                />
                <div className="flex flex-col gap-0.5 text-sm">
                    {Object.entries(repos).map(([name, { count, icon, iconAltText, isSelected }]) => (
                        <div
                            key={name}
                            className={clsx("flex flex-row items-center justify-between py-0.5 px-2 cursor-pointer hover:bg-blue-200 rounded-md",
                                {
                                    "bg-blue-200": isSelected,
                                }
                            )}
                            onClick={() => onEntryClicked(name)}
                        >
                            <div className="flex flex-row items-center gap-1">
                                {icon ? (
                                    <Image
                                        src={icon}
                                        alt={iconAltText ?? ''}
                                        className="w-4 h-4 flex-shrink-0"
                                    />
                                ) : (
                                    <FileIcon className="w-4 h-4 flex-shrink-0" />
                                )}
                                <p>{name}</p>
                            </div>
                            <p>{count}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}