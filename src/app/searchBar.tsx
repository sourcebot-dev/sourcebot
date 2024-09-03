'use client';

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { cva } from "class-variance-authority";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface SearchBarProps {
    className?: string;
    size?: "default" | "sm";
    defaultQuery?: string;
}

const formSchema = z.object({
    query: z.string(),
});

const searchBarVariants = cva(
    "w-full",
    {
        variants: {
            size: {
                default: "h-10",
                sm: "h-8"
            }
        },
        defaultVariants: {
            size: "default",
        }
    }
)

export const SearchBar = ({
    className,
    size,
    defaultQuery,
}: SearchBarProps) => {
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            query: defaultQuery ?? "",
        }
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        router.push(`/search?query=${values.query}&numResults=100`);
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full"
            >
                <FormField
                    control={form.control}
                    name="query"
                    render={( { field }) => (
                        <FormItem>
                            <FormControl>
                                <Input
                                    placeholder="Search..."
                                    className={cn(searchBarVariants({ size, className }))}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    )
}