'use client';

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";
import { captureEvent } from "@/hooks/useCaptureEvent";
import { RepositoryQuery } from "@/lib/types";
import { getCodeHostInfoForRepo } from "@/lib/utils";
import clsx from "clsx";
import Autoscroll from "embla-carousel-auto-scroll";
import Image from "next/image";
import Link from "next/link";
import { useDomain } from "@/hooks/useDomain";

interface RepositoryCarouselProps {
    displayRepos: RepositoryQuery[];
    numberOfReposWithIndex: number;
}

export function RepositoryCarousel({
    displayRepos,
    numberOfReposWithIndex,
}: RepositoryCarouselProps) {
    const domain = useDomain();

    if (numberOfReposWithIndex === 0) {
        return (
            <div className="flex flex-col items-center gap-3">
                <span className="text-sm">No repositories found</span>

                <div className="w-full max-w-lg">
                    <div className="flex flex-row items-center gap-2 border rounded-md p-4 justify-center">
                        <span className="text-sm text-muted-foreground">
                            <>
                                Create a{" "}
                                <Link href={`/${domain}/settings/connections`} className="text-blue-500 hover:underline inline-flex items-center gap-1">
                                    connection
                                </Link>{" "}
                                to start indexing repositories
                            </>
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">
                {`${numberOfReposWithIndex} `}
                <Link
                    href={`/${domain}/repos`}
                    className="text-link hover:underline"
                >
                    {numberOfReposWithIndex > 1 ? 'repositories' : 'repository'}
                </Link>
                {` indexed`}
            </span>
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
                    {displayRepos.map((repo, index) => (
                        <CarouselItem key={index} className="basis-auto">
                            <RepositoryBadge
                                key={index}
                                repo={repo}
                            />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
            {process.env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT === "demo" && (
                <p className="text-sm text-muted-foreground text-center">
                    Interested in using Sourcebot on your code? Check out our{' '}
                    <a
                        href="https://docs.sourcebot.dev/docs/overview"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={() => captureEvent('wa_demo_docs_link_pressed', {})}
                    >
                        docs
                    </a>
                </p>
            )}
        </div>
    )
}

interface RepositoryBadgeProps {
    repo: RepositoryQuery;
}

const RepositoryBadge = ({
    repo
}: RepositoryBadgeProps) => {
    const { repoIcon, displayName } = (() => {
        const info = getCodeHostInfoForRepo({
            codeHostType: repo.codeHostType,
            name: repo.repoName,
            displayName: repo.repoDisplayName,
            externalWebUrl: repo.externalWebUrl,
        });

        return {
            repoIcon: <Image
                src={info.icon}
                alt={info.codeHostName}
                className={`w-4 h-4 ${info.iconClassName}`}
            />,
            displayName: info.displayName,
        }
    })();

    return (
        <Link
            href={repo.webUrl}
            className={clsx("flex flex-row items-center gap-2 border rounded-md p-2 text-clip")}
        >
            {repoIcon}
            <span className="text-sm font-mono">
                {displayName}
            </span>
        </Link>
    )
}
