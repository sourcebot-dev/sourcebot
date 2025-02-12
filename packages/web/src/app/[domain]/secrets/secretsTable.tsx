'use client';

import { useEffect, useMemo, useState } from "react";
import { getSecrets, createSecret } from "../../../actions"
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { columns, SecretColumnInfo } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { deleteSecret } from "../../../actions"
import { useDomain } from "@/hooks/useDomain";

const formSchema = z.object({
    key: z.string().min(2).max(40),
    value: z.string().min(2).max(40),
});

interface SecretsTableProps {
    initialSecrets: { createdAt: Date; key: string; }[];
}


export const SecretsTable = ({ initialSecrets }: SecretsTableProps) => {
    const [secrets, setSecrets] = useState<{ createdAt: Date; key: string; }[]>(initialSecrets);
    const { toast } = useToast();
    const domain = useDomain();

    const fetchSecretKeys = async () => {
        const keys = await getSecrets(domain);
        if ('keys' in keys) {
            setSecrets(keys);
        } else {
            console.error(keys);
        }
    };

    useEffect(() => {
        fetchSecretKeys();
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            key: "",
            value: "",
        },
    });

    const handleCreateSecret = async (values: { key: string, value: string }) => {
        const res = await createSecret(values.key, values.value, domain);
        if (isServiceError(res)) {
            toast({
                description: `❌ Failed to create secret`
            });
            return;
        } else {
            toast({
                description: `✅ Secret created successfully!`
            });
        }

        const keys = await getSecrets(domain);
        if (isServiceError(keys)) {
            console.error("Failed to fetch secrets");
        } else {
            setSecrets(keys);
            
            form.reset();
            form.resetField("key");
            form.resetField("value");
        }
    };

    const handleDelete = async (key: string) => {
        const res = await deleteSecret(key, domain);
        if (isServiceError(res)) {
            toast({
                description: `❌ Failed to delete secret`
            });
            return;
        } else {
            toast({
                description: `✅ Secret deleted successfully!`
            });
        }

        const keys = await getSecrets(domain);
        if ('keys' in keys) {
            setSecrets(keys);
        } else {
            console.error(keys);
        }
    };


    const keys = useMemo(() => {
        return secrets.map((secret): SecretColumnInfo => {
            return {
                key: secret.key,
                createdAt: secret.createdAt.toISOString(),
            }
        }).sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [secrets]);

    return (
        <div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateSecret)}>
                    <FormField
                        control={form.control}
                        name="key"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Key</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="value"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Value</FormLabel>
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
            <DataTable 
                columns={columns(handleDelete)}
                data={keys}
                searchKey="key"
                searchPlaceholder="Search secrets..."
            />
        </div>
    );
};