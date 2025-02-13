'use client';
import { useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { MemberColumnInfo, MemberTableColumns } from "./memberTableColumns";

export interface MemberInfo {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface MemberTableProps {
    currentUserId: string;
    initialMembers: MemberInfo[];
}

export const MemberTable = ({ currentUserId, initialMembers }: MemberTableProps) => {
    const memberRows: MemberColumnInfo[] = useMemo(() => {
        return initialMembers.map(member => {
            return {
                id: member.id!,
                name: member.name!,
                email: member.email!,
                role: member.role!,
            }
        })
    }, [initialMembers]);

    return (
        <div className="space-y-2">
            <h4 className="text-lg font-normal">Members</h4>
            <DataTable
                columns={MemberTableColumns(currentUserId)}
                data={memberRows}
                searchKey="name"
                searchPlaceholder="Search members..."
            />
        </div>
    )
}