"use client"

import { cn, type CodeHostType, getCodeHostIcon } from "@/lib/utils"
import placeholderLogo from "@/public/placeholder_avatar.png"
import { BlocksIcon, LockIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useMemo } from "react"
import { OrgRole } from "@sourcebot/db"

interface NewConnectionCardProps {
    className?: string
    role: OrgRole
    configPathProvided: boolean
}

export const NewConnectionCard = ({ className, role, configPathProvided }: NewConnectionCardProps) => {
    const isOwner = role === OrgRole.OWNER
    const isDisabled = !isOwner || configPathProvided

    return (
        <div
            className={cn(
                "flex flex-col border rounded-lg p-4 h-fit relative",
                isDisabled && "bg-muted/10 border-muted cursor-not-allowed",
                className,
            )}
        >
            {isDisabled && (
                <div className="absolute right-3 top-3">
                    <LockIcon className="w-4 h-4 text-muted-foreground" />
                </div>
            )}
            <BlocksIcon className={cn("mx-auto w-7 h-7", isDisabled && "text-muted-foreground")} />
            <h2 className={cn("mx-auto mt-4 font-medium text-lg", isDisabled && "text-muted-foreground")}>
                Connect to a Code Host
            </h2>
            <p className="mx-auto text-center text-sm text-muted-foreground font-light">
                Create a connection to import repos from a code host.
            </p>
            <div className="flex flex-col gap-2 mt-4">
                <Card
                    type="github"
                    title="GitHub"
                    subtitle="Cloud or Enterprise supported."
                    disabled={isDisabled} 
                />
                <Card
                    type="gitlab" 
                    title="GitLab"
                    subtitle="Cloud and Self-Hosted supported."
                    disabled={isDisabled}
                />
                <Card
                    type="bitbucket-cloud"
                    title="Bitbucket Cloud"
                    subtitle="Fetch repos from Bitbucket Cloud."
                    disabled={isDisabled}
                />
                <Card
                    type="bitbucket-server"
                    title="Bitbucket Data Center"
                    subtitle="Fetch repos from a Bitbucket DC instance."
                    disabled={isDisabled}
                />
                <Card
                    type="gitea"
                    title="Gitea" 
                    subtitle="Cloud and Self-Hosted supported."
                    disabled={isDisabled}
                />
                <Card
                    type="gerrit"
                    title="Gerrit"
                    subtitle="Cloud and Self-Hosted supported."
                    disabled={isDisabled}
                />
            </div>
            {isDisabled && (
                <p className="mt-4 text-xs text-center text-muted-foreground">
                    {configPathProvided 
                        ? "Connections are managed through the configuration file."
                        : "Only organization owners can manage connections."}
                </p>
            )}
        </div>
    )
}

interface CardProps {
    type: string
    title: string
    subtitle: string
    disabled?: boolean
}

const Card = ({ type, title, subtitle, disabled = false }: CardProps) => {
    const Icon = useMemo(() => {
        const iconInfo = getCodeHostIcon(type as CodeHostType)
        if (iconInfo) {
            const { src, className } = iconInfo
            return (
                <Image
                    src={src || "/placeholder.svg"}
                    className={cn("rounded-full w-7 h-7 mb-1", className, disabled && "opacity-50")}
                    alt={`${type} logo`}
                />
            )
        }

        return (
            <Image
                src={placeholderLogo || "/placeholder.svg"}
                alt={`${type} logo`}
                className={cn("rounded-full w-7 h-7 mb-1", disabled && "opacity-50")}
            />
        )
    }, [type, disabled])

    const CardContent = (
        <div
            className={cn(
                "flex flex-row justify-between items-center p-2",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                disabled && "opacity-70",
            )}
        >
            <div className="flex flex-row items-center gap-2">
                {Icon}
                <div>
                    <p className={cn("font-medium", disabled && "text-muted-foreground")}>{title}</p>
                    <p className="text-sm text-muted-foreground font-light">{subtitle}</p>
                </div>
            </div>
        </div>
    )

    if (disabled) {
        return CardContent
    }

    return (
        <Link className="flex flex-row justify-between items-center cursor-pointer" href={`connections/new/${type}`}>
            {CardContent}
        </Link>
    )
}

