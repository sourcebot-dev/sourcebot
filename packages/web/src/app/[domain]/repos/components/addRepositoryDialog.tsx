'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { experimental_addGithubRepositoryByUrl } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

interface AddRepositoryDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

// Validation schema for repository URLs
const formSchema = z.object({
    repositoryUrl: z.string()
        .min(1, "Repository URL is required")
        .refine((url) => {
            // Allow various GitHub URL formats:
            // - https://github.com/owner/repo
            // - github.com/owner/repo
            // - owner/repo
            const patterns = [
                /^https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/,
                /^github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/,
                /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/
            ];
            return patterns.some(pattern => pattern.test(url.trim()));
        }, "Please enter a valid GitHub repository URL (e.g., owner/repo or https://github.com/owner/repo)"),
});

export const AddRepositoryDialog = ({ isOpen, onOpenChange }: AddRepositoryDialogProps) => {
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            repositoryUrl: "",
        },
    });

    const { isSubmitting } = form.formState;

    const onSubmit = async (data: z.infer<typeof formSchema>) => {

        const result = await experimental_addGithubRepositoryByUrl(data.repositoryUrl.trim());
        if (isServiceError(result)) {
            toast({
                title: "Error adding repository",
                description: result.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Repository added successfully!",
                description: "It will be indexed shortly.",
            });
            form.reset();
            onOpenChange(false);
            router.refresh();
        }
    };

    const handleCancel = () => {
        form.reset();
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a public repository from GitHub</DialogTitle>
                    <DialogDescription>
                        Paste the repo URL - the code will be indexed and available in search.
                    </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="repositoryUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Repository URL</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="https://github.com/user/project"
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Adding..." : "Add Repository"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
