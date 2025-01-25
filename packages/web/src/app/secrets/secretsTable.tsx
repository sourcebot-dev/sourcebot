'use client';
import { useEffect, useState } from "react";
import { getSecrets, createSecret } from "../../actions"
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { columns, SecretColumnInfo } from "./columns";
import { DataTable } from "@/components/ui/data-table";

const formSchema = z.object({
    key: z.string().min(2).max(40),
    value: z.string().min(2).max(40),
});

export const SecretsTable = () => {
    const [secrets, setSecrets] = useState<{ createdAt: Date; key: string; }[]>([]);

    useEffect(() => {
        const fetchSecretKeys = async () => {
            const keys = await getSecrets();
            if ('keys' in keys) {
                setSecrets(keys);
            } else {
                console.error(keys);
            }
        };

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
        await createSecret(values.key, values.value);
        const keys = await getSecrets();
        if ('keys' in keys) {
            setSecrets(keys);

            form.reset();
            form.resetField("key");
            form.resetField("value");
        } else {
            console.error(keys);
        }
    };


    const keys = secrets.map((secret): SecretColumnInfo => {
        return {
            key: secret.key,
            createdAt: secret.createdAt.toISOString(),
        }
    }).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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
                columns={columns}
                data={keys}
                searchKey="key"
                searchPlaceholder="Search secrets..."
            />
        </div>
    );
};