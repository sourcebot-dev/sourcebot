'use client';
import { useEffect, useMemo, useState } from "react";
import { User } from "@sourcebot/db";
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
    const [members, setMembers] = useState<MemberInfo[]>(initialMembers);
    
    const memberRows: MemberColumnInfo[] = useMemo(() => {
        return members.map(member => {
            return {
                name: member.name!,
                role: member.role!,
            }
        })
    }, [members]);

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