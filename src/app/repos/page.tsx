'use client';

import { NavigationMenu } from "../navigationMenu";
import { RepositoryTable } from "./repositoryTable";

export default function ReposPage() {
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu />
            <RepositoryTable />
        </div>
    )
}