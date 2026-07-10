import { BookOpenIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SkillsEmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
                <BookOpenIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium text-foreground">No skill selected</p>
            <p className="max-w-sm text-sm text-muted-foreground">
                Select a skill to view its details, or create a personal slash-command workflow for Ask Sourcebot.
            </p>
            <Button variant="outline" className="mt-4" onClick={onCreate}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create skill
            </Button>
        </div>
    );
}
