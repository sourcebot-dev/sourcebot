import { cn, CodeHostType, getCodeHostIcon } from "@/lib/utils";
import placeholderLogo from "@/public/placeholder_avatar.png";
import { BlocksIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

interface NewConnectionCardProps {
    className?: string;
}

export const NewConnectionCard = ({
    className,
}: NewConnectionCardProps) => {
    return (
        <div className={cn("flex flex-col border rounded-lg p-4 h-fit", className)}>
            <BlocksIcon className="mx-auto w-7 h-7" />
            <h2 className="mx-auto mt-4 font-medium text-lg">Connect to a Code Host</h2>
            <p className="mx-auto text-center text-sm text-muted-foreground font-light">Create a connection to import repos from a code host.</p>
            <div className="flex flex-col gap-2 mt-4">
                <Card
                    type="github"
                    title="GitHub"
                    subtitle="Cloud or Enterprise supported."
                />
                <Card
                    type="gitlab"
                    title="GitLab"
                    subtitle="Cloud and Self-Hosted supported."
                />
                <Card
                    type="gitea"
                    title="Gitea"
                    subtitle="Cloud and Self-Hosted supported."
                />
                <Card
                    type="gerrit"
                    title="Gerrit"
                    subtitle="Cloud and Self-Hosted supported."
                />
            </div>
        </div>
    )
}

interface CardProps {
    type: string;
    title: string;
    subtitle: string;
}

const Card = ({
    type,
    title,
    subtitle,
}: CardProps) => {
    const Icon = useMemo(() => {
        const iconInfo = getCodeHostIcon(type as CodeHostType);
        if (iconInfo) {
            const { src, className } = iconInfo;
            return (
                <Image
                    src={src}
                    className={cn("rounded-full w-7 h-7 mb-1", className)}
                    alt={`${type} logo`}
                />
            )
        }

        return <Image
            src={placeholderLogo}
            alt={`${type} logo`}
            className="rounded-full w-7 h-7 mb-1"
        />

    }, [type]);

    return (
        <Link
            className="flex flex-row justify-between items-center cursor-pointer p-2"
            href={`/connections/new/${type}`}
        >
            <div className="flex flex-row items-center gap-2">
                {Icon}
                <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground font-light">{subtitle}</p>
                </div>
            </div>
        </Link>
    )
}