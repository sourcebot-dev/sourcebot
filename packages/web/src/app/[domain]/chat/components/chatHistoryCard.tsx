import React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Lock, Globe, Clock, ArrowRight } from "lucide-react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function ChatHistoryCard({
    chat,
    domain,
}: {
    chat: any;
    domain: string;
}) {
    const formatDate = (date: Date) => {
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        if (diffInHours < 24) {
            return 'Today';
        } else if (diffInDays < 7) {
            return `${Math.floor(diffInDays)} days ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    return (
        <Link key={chat.id} href={`/${domain}/chat/${chat.id}`} className="group">
            <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-105 bg-gradient-to-br from-card to-card/50">
                <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 transition-colors">
                                <MessageSquare className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 my-auto">
                                <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors text-ellipsis line-clamp-2 align-middle">
                                    {chat.name || "Untitled Chat"}
                                </CardTitle>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex justify-between items-center px-4 pb-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDate(new Date(chat.createdAt))}</span>
                    </div>
                    {chat.visibility === 'PRIVATE' ? (
                        <Badge variant="secondary" className="gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                            <Lock className="h-3 w-3" />
                            Private
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <Globe className="h-3 w-3" />
                            Public
                        </Badge>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
