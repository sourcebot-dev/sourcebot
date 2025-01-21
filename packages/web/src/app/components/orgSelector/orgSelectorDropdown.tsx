'use client';
import { createOrg, switchActiveOrg } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isServiceError } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CaretSortIcon, CheckIcon, GitHubLogoIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import Fuse from "fuse.js";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";


interface OrgSelectorDropdownProps {
    orgs: {
        name: string,
        id: number,
    }[],
    activeOrgId: number,
}

export const OrgSelectorDropdown = ({
    orgs,
    activeOrgId
}: OrgSelectorDropdownProps) => {
    const activeOrg = orgs.find((org) => org.id === activeOrgId)!;
    const [searchFilter, setSearchFilter] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const filteredOrgs = useMemo(() => {
        if (searchFilter === "") {
            // always place the active org at the top
            return [
                activeOrg,
                ...orgs.filter(org => org.id !== activeOrgId),
            ];
        }

        const fuse = new Fuse(orgs, {
            keys: ["name"],
        });
        return fuse
            .search(searchFilter)
            .map((result) => result.item);
    }, [searchFilter, orgs, activeOrg, activeOrgId]);

    
    return (
        /*
            We need to set `modal=false` to fix a issue with having a dialog menu inside of
            a dropdown menu.
            @see : https://github.com/radix-ui/primitives/issues/1836#issuecomment-1547607143
        */
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="default">
                    <GitHubLogoIcon className="h-5 w-5 mr-1.5" />
                    <p className="font-medium text-sm mr-1">{activeOrg.name}</p>
                    <CaretSortIcon className="h-5 w-5 font-medium" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-64"
                // Handle re-focusing the search input
                onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' && document.activeElement?.getAttribute('role') === 'menuitem') {
                        const menuItems = event.currentTarget.querySelectorAll('[role="menuitem"]');
                        const currentIndex = Array.from(menuItems).indexOf(document.activeElement);

                        if (currentIndex === 0) {
                            // If we're at the first menu item, move focus back to input
                            event.currentTarget.querySelector('input')?.focus();
                        }
                    }
                }}
            >
                <div className="flex flex-row gap-0.5 items-center py-1 px-2">
                    <SearchIcon className="h-5 w-5 text-muted-foreground" />
                    <Input
                        value={searchFilter}
                        className="focus-visible:ring-transparent border-none w-full"
                        autoFocus={true}
                        placeholder="Search organizations"
                        onChange={(event) => setSearchFilter(event.target.value)}
                        // Handles focusing the first menu item when pressing the arrow keys
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                // Get the parent DropdownMenuContent element
                                const dropdownContent = (event.target as HTMLElement).parentElement?.closest('[role="menu"]');
                                if (!dropdownContent) return;

                                // Get all menu items
                                const menuItems = dropdownContent.querySelectorAll('[role="menuitem"]');
                                if (menuItems.length === 0) return;

                                // Focus the first menu item
                                (menuItems[0] as HTMLElement).focus();
                            }
                        }}
                    />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <ScrollArea className="flex max-h-80 flex-col overflow-y-auto">
                        {filteredOrgs.map((org, index) => (
                            <DropdownMenuItem
                                key={index}
                                tabIndex={-1}
                            >
                                <Button
                                    onClick={() => {
                                        switchActiveOrg(org.id)
                                            .then(() => {
                                                toast({
                                                    description: `✅ Switched to ${org.name}`,
                                                });
                                                
                                                // Necessary to refresh the server component.
                                                router.refresh();
                                            })
                                            .catch((error) => {
                                                if (isServiceError(error)) {
                                                    toast({
                                                        description: `❌ Failed to switch organization. Reason: ${error.message}`,
                                                    });
                                                }
                                            })
                                            .finally(() => {
                                                setIsDialogOpen(false);
                                            });
                                    }}
                                    tabIndex={-1}
                                    key={org.id}
                                    variant="ghost"
                                    className="w-full justify-between p-0"
                                >
                                    <div className="flex flex-row gap-1.5 items-center">
                                        <GitHubLogoIcon className="h-5 w-5" />
                                        {org.name}
                                    </div>
                                    {org.id === activeOrgId && (
                                        <CheckIcon className="h-5 w-5 text-muted-foreground" />
                                    )}
                                </Button>
                            </DropdownMenuItem>
                        ))}
                    </ScrollArea>
                </DropdownMenuGroup>
                {searchFilter.length === 0 && (
                    <DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <Dialog
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                        >
                            <DialogTrigger asChild>
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    <Button
                                        variant="ghost"
                                        size="default"
                                        className="w-full justify-start gap-1.5 p-0"
                                    >
                                        <PlusCircledIcon className="h-5 w-5 text-muted-foreground" />
                                        Create organization
                                    </Button>
                                </DropdownMenuItem>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create an organization</DialogTitle>
                                    <DialogDescription>Collaborate with</DialogDescription>
                                </DialogHeader>
                                <OrgCreationForm
                                    onSubmit={({ name }) => {
                                        createOrg(name)
                                            .then((response) => {
                                                if (isServiceError(response)) {
                                                    throw response;
                                                }
                                                
                                                return switchActiveOrg(response.id);
                                            })
                                            .then((response) => {
                                                if (isServiceError(response)) {
                                                    throw response;
                                                }

                                                toast({
                                                    description: `✅ Organization '${name}' created successfully.`,
                                                });
                                                
                                                // Necessary to refresh the server component.
                                                router.refresh();
                                            })
                                            .catch((error) => {
                                                if (isServiceError(error)) {
                                                    toast({
                                                        description: `❌ Failed to create organization. Reason: ${error.message}`,
                                                    });
                                                }
                                            })
                                            .finally(() => {
                                                setIsDialogOpen(false);
                                            });
                                    }}
                                />
                            </DialogContent>
                        </Dialog>
                    </DropdownMenuGroup>
                )}
                {searchFilter.length > 0 && filteredOrgs.length === 0 && (
                    <DropdownMenuGroup className="p-3 flex flex-col gap-3">
                        <p className="text-sm">No organization found</p>
                        <p className="text-sm text-muted-foreground">{`Your search term "${searchFilter}" did not match any organizations.`}</p>
                        <DropdownMenuItem>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setSearchFilter("")}
                            >
                                Clear search
                            </Button>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


const formSchema = z.object({
    name: z.string().min(2).max(40),
});

interface OrgCreationFormProps {
    onSubmit: (data: z.infer<typeof formSchema>) => void;
}

export const OrgCreationForm = ({
    onSubmit,
}: OrgCreationFormProps) => {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization name</FormLabel>
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
    )
}