'use client';

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
import Autoscroll from "embla-carousel-auto-scroll";
import { getCodeHostInfoForRepo } from "@/lib/utils";
import Image from "next/image";
import { FileIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { RepositoryQuery } from "@/lib/types";
import { getBrowsePath } from "../../browse/hooks/useBrowseNavigation";
import Link from "next/link";
import { useDomain } from "@/hooks/useDomain";

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
    const domain = useDomain();
    const { repoIcon, displayName } = (() => {
        const info = getCodeHostInfoForRepo({
            codeHostType: repo.codeHostType,
            name: repo.repoName,
            displayName: repo.repoDisplayName,
            webUrl: repo.webUrl,
        });

        if (info) {
            return {
                repoIcon: <Image
                    src={info.icon}
                    alt={info.codeHostName}
                    className={`w-4 h-4 ${info.iconClassName}`}
                />,
                displayName: info.displayName,
            }
        }

        return {
            repoIcon: <FileIcon className="w-4 h-4" />,
            displayName: repo.repoName,
        }
    })();

    return (
        <Link
            href={getBrowsePath({
                repoName: repo.repoName,
                path: '/',
                pathType: 'tree',
                domain
            })}
           
            className={clsx("flex flex-row items-center gap-2 border rounded-md p-2 text-clip")}
        >
            {repoIcon}
            <span className="text-sm font-mono">
                {displayName}
            </span>
        </Link>
    )
}
