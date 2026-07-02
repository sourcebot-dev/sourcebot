"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type MemberFilter } from "./membersTable";

const FILTER_OPTIONS: { value: MemberFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "owners", label: "Owners" },
    { value: "members", label: "Members" },
    { value: "active", label: "Active" },
    { value: "pending", label: "Pending" },
    { value: "suspended", label: "Suspended" },
    { value: "invited", label: "Invited" },
    { value: "requests", label: "Requests" },
];

interface MembersFilterSelectProps {
    value: MemberFilter;
    onValueChange: (value: MemberFilter) => void;
}

export const MembersFilterSelect = ({ value, onValueChange }: MembersFilterSelectProps) => {
    return (
        <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as MemberFilter)}>
            <SelectTrigger className="w-fit">
                <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
                {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};
