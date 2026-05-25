import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerIcon } from "lucide-react";

export function McpConfigurationUnavailableMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12">
            <Card className="w-full max-w-lg bg-card border-border p-2">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-muted">
                            <ServerIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </div>
                    <CardTitle className="text-xl font-semibold text-card-foreground">
                        MCP Configuration Is Unavailable
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-2">
                        OAuth-backed MCP servers are not supported on this Sourcebot instance.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">
                        Use Sourcebot API keys for MCP access on this deployment.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
