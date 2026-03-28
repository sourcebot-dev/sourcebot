import { PlusIcon } from "lucide-react";

export const PlusButtonInfoCard = () => {
    return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-4 w-80 max-w-[90vw]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                <PlusIcon className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-popover-foreground">Extra Features</h4>
            </div>
            <div className="text-sm text-popover-foreground leading-relaxed">
                Add MCP servers, include files and more.
            </div>
        </div>
    );
};