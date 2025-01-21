'use client';
import { createOrg, switchActiveOrg } from "@/actions";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isServiceError } from "@/lib/utils";
import { CaretSortIcon, CheckIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { OrgCreationDialog } from "./orgCreationDialog";


interface OrgSelectorDropdownProps {
    orgs: {
        name: string,
        id: number,
    }[],
    activeOrgId: number,
}

export const OrgSelectorDropdown = ({
    orgs: _orgs,
    activeOrgId
}: OrgSelectorDropdownProps) => {
    const [searchFilter, setSearchFilter] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const activeOrg = _orgs.find((org) => org.id === activeOrgId)!;
    const orgs = useMemo(() => {
        // always place the active org at the top
        return [
            activeOrg,
            ..._orgs.filter(org => org.id !== activeOrgId),
        ];
    }, [_orgs, activeOrg, activeOrgId]);

    const onSwitchOrg = useCallback((orgId: number, orgName: string) => {
        switchActiveOrg(orgId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to switch organization. Reason: ${response.message}`,
                    });
                } else {
                    toast({
                        description: `✅ Switched to ${orgName}`,
                    });
                }


                setIsDropdownOpen(false);
                // Necessary to refresh the server component.
                router.refresh();
            });
    }, [router, toast]);

    const onCreateOrg = useCallback((name: string) => {
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

                setIsDropdownOpen(false);
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
                setIsCreateOrgDialogOpen(false);
            });
    }, [router, toast]);


    return (
        /*
            We need to set `modal=false` to fix a issue with having a dialog menu inside of
            a dropdown menu.
            @see : https://github.com/radix-ui/primitives/issues/1836#issuecomment-1547607143
        */
        <DropdownMenu
            modal={false}
            open={isDropdownOpen}
            onOpenChange={setIsDropdownOpen}
        >
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="default">
                    <GitHubLogoIcon className="h-5 w-5 mr-1.5" />
                    <p className="font-medium text-sm mr-1">{activeOrg.name}</p>
                    <CaretSortIcon className="h-5 w-5 font-medium" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
                <DropdownMenuGroup>
                    <Command>
                        <CommandInput
                            className="focus-visible:ring-transparent border-none w-full"
                            placeholder="Search organizations..."
                            value={searchFilter}
                            onValueChange={(value) => setSearchFilter(value)}
                            autoFocus={true}
                        />
                        <CommandList>
                            <CommandEmpty className="p-3 flex flex-col gap-3">
                                <p className="text-sm">No organization found</p>
                                <p className="text-sm text-muted-foreground">{`Your search term "${searchFilter}" did not match any organizations.`}</p>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setSearchFilter("")}
                                >
                                    Clear search
                                </Button>
                            </CommandEmpty>
                            <CommandGroup
                                heading="Organizations"
                                className="flex max-h-80 flex-col overflow-y-auto"
                            >
                                {orgs.map((org, index) => (
                                    <CommandItem
                                        key={index}
                                        // Need to include org id to handle duplicates.
                                        value={`${org.name}-${org.id}`}
                                        className="w-full justify-between py-3 font-medium cursor-pointer"
                                        onSelect={() => onSwitchOrg(org.id, org.name)}
                                    >
                                        <div className="flex flex-row gap-1.5 items-center">
                                            <GitHubLogoIcon className="h-5 w-5" />
                                            {org.name}
                                        </div>
                                        {org.id === activeOrgId && (
                                            <CheckIcon className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>

                    </Command>
                </DropdownMenuGroup>
                {searchFilter.length === 0 && (
                    <DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <OrgCreationDialog
                            isOpen={isCreateOrgDialogOpen}
                            onOpenChange={setIsCreateOrgDialogOpen}
                            onSubmit={({ name }) => onCreateOrg(name)}
                        />
                    </DropdownMenuGroup>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
