'use client';

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
import Autoscroll from "embla-carousel-auto-scroll";
import { getRepoQueryCodeHostInfo } from "@/lib/utils";
import Image from "next/image";
import { FileIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { RepositoryQuery } from "@/lib/types";

interface RepositoryCarouselProps {
    repos: RepositoryQuery[];
}

export const RepositoryCarousel = ({
    repos,
}: RepositoryCarouselProps) => {
    return (
        <Carousel
            opts={{
                align: "start",
                loop: true,
            }}
            className="w-full max-w-lg"
            plugins={[
                Autoscroll({
                    startDelay: 0,
                    speed: 1,
                    stopOnMouseEnter: true,
                    stopOnInteraction: false,
                }),
            ]}
        >
            <CarouselContent>
                {repos.map((repo, index) => (
                    <CarouselItem key={index} className="basis-auto">
                        <RepositoryBadge
                            key={index}
                            repo={repo}
                        />
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    )
};

interface RepositoryBadgeProps {
    repo: RepositoryQuery;
}

const RepositoryBadge = ({
    repo
}: RepositoryBadgeProps) => {
    const { repoIcon, displayName, repoLink } = (() => {
        const info = getRepoQueryCodeHostInfo(repo);

        if (info) {
            return {
                repoIcon: <Image
                    src={info.icon}
                    alt={info.costHostName}
                    className={`w-4 h-4 ${info.iconClassName}`}
                />,
                displayName: info.displayName,
                repoLink: info.repoLink,
            }
        }

        return {
            repoIcon: <FileIcon className="w-4 h-4" />,
            displayName: repo.repoName.split('/').slice(-2).join('/'),
            repoLink: undefined,
        }
    })();

    return (
        <div
            onClick={() => {
                if (repoLink !== undefined) {
                    window.open(repoLink, "_blank");
                }
            }}
            className={clsx("flex flex-row items-center gap-2 border rounded-md p-2 text-clip", {
                "cursor-pointer": repoLink !== undefined,
            })}
        >
            {repoIcon}
            <span className="text-sm font-mono">
                {displayName}
            </span>
        </div>
    )
}
