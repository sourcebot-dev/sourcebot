'use client'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { createInvite } from "@/actions"
import { isServiceError } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";

const formSchema = z.object({
    email: z.string().min(2).max(40),
});

export const MemberInviteForm = ({ userId }: { userId: string }) => {
    const { toast } = useToast();
    const domain = useDomain();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    const handleCreateInvite = async (values: { email: string }) => {
        const res = await createInvite(values.email, userId, domain);
        if (isServiceError(res)) {
            toast({
                description: `❌ Failed to create invite`
            });
            return;
        } else {
            toast({
                description: `✅ Invite created successfully!`
            });
        }
    }

    return (
        <div className="space-y-2">
            <h4 className="text-lg font-normal">Invite a member</h4>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateInvite)}>
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button className="mt-5" type="submit">Submit</Button>
                </form>
            </Form>
        </div>
    );
}