'use client';

import { updateConnectionDisplayName } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
    name: z.string().min(1),
});

interface DisplayNameSettingProps {
    connectionId: number;
    name: string;
}

export const DisplayNameSetting = ({
    connectionId,
    name,
}: DisplayNameSettingProps) => {
    const { toast } = useToast();
    const router = useRouter();
    const domain = useDomain();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name,
        },
    });

    const [isLoading, setIsLoading] = useState(false);
    const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        updateConnectionDisplayName(connectionId, data.name, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to rename connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection renamed successfully.`
                    });
                    router.refresh();
                }
            }).finally(() => {
                setIsLoading(false);
            });
    }, [connectionId, domain, router, toast]);

    return (
        <div className="flex flex-col w-full bg-background border rounded-lg p-6">
            <Form
                {...form}
            >
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-lg font-semibold">Display Name</FormLabel>
                                {/* @todo : refactor this description into a shared file */}
                                <FormDescription>This is the {`connection's`} display name within Sourcebot. Examples: <b>public-github</b>, <b>self-hosted-gitlab</b>, <b>gerrit-other</b>, etc.</FormDescription>
                                <FormControl className="max-w-lg">
                                    <Input
                                        {...field}
                                        spellCheck={false}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="animate-spin mr-2" />}
                            Save
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}