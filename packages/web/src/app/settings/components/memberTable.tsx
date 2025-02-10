'use client';
import { useMemo } from "react";
import { DataTable } from "@/components/ui/data-table";
import { MemberColumnInfo, memberTableColumns } from "./memberTableColumns";

export interface MemberInfo {
    name: string;
    role: string;
}

interface MemberTableProps {
    initialMembers: MemberInfo[];
}

export const MemberTable = ({ initialMembers }: MemberTableProps) => {
    const memberRows: MemberColumnInfo[] = useMemo(() => {
        return initialMembers.map(member => {
            return {
                name: member.name!,
                role: member.role!,
            }
        })
    }, [initialMembers]);

    return (
        <div>
            <DataTable
                columns={memberTableColumns()}
                data={memberRows}
                searchKey="name"
                searchPlaceholder="Search members..."
            />
        </div>
    )
}