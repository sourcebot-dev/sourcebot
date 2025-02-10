'use client'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast";
import { createInvite } from "../../../actions"
import { isServiceError } from "@/lib/utils";

const formSchema = z.object({
    email: z.string().min(2).max(40),
});

export const MemberInviteForm = ({ orgId, userId }: { orgId: number, userId: string }) => {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    const handleCreateInvite = async (values: { email: string }) => {
        const res = await createInvite(values.email, userId, orgId);
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
        <div>
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