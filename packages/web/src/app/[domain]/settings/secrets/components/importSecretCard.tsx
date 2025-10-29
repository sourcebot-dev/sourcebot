'use client';

import { CodeHostIconButton } from "@/app/[domain]/components/codeHostIconButton";
import { Card, CardTitle, CardDescription, CardHeader, CardContent } from "@/components/ui/card";
import { getCodeHostIcon } from "@/lib/utils";
import { cn, CodeHostType } from "@/lib/utils";
import { useState } from "react";
import { ImportSecretDialog } from "@/app/[domain]/components/importSecretDialog";
import { useRouter } from "next/navigation";

interface ImportSecretCardProps {
    className?: string;
}

export const ImportSecretCard = ({ className }: ImportSecretCardProps) => {
    const [selectedCodeHost, setSelectedCodeHost] = useState<CodeHostType | null>(null);
    const [isImportSecretDialogOpen, setIsImportSecretDialogOpen] = useState(false);
    const router = useRouter();

    return (
        <>
            <Card className={cn(className)}>
                <CardHeader>
                    <CardTitle>Import a new secret</CardTitle>
                    <CardDescription>Import a secret from a code host to allow Sourcebot to sync private repositories.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-row gap-4 w-full justify-center">
                    <CodeHostIconButton
                        name="GitHub"
                        logo={getCodeHostIcon("github")}
                        onClick={() => {
                            setSelectedCodeHost("github");
                            setIsImportSecretDialogOpen(true);
                        }}
                    />
                    <CodeHostIconButton
                        name="GitLab"
                        logo={getCodeHostIcon("gitlab")}
                        onClick={() => {
                            setSelectedCodeHost("gitlab");
                            setIsImportSecretDialogOpen(true);
                        }}
                    />
                    <CodeHostIconButton
                        name="Gitea"
                        logo={getCodeHostIcon("gitea")}
                        onClick={() => {
                            setSelectedCodeHost("gitea");
                            setIsImportSecretDialogOpen(true);
                        }}
                    />
                </CardContent>
            </Card>
            {selectedCodeHost && (
                <ImportSecretDialog
                    open={isImportSecretDialogOpen}
                    onOpenChange={setIsImportSecretDialogOpen}
                    onSecretCreated={() => {
                        router.refresh();
                    }}
                    codeHostType={selectedCodeHost ?? "github"}
                />
            )}
        </>
    )
}