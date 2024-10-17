import { JSONFilePreset } from "lowdb/node";
import { type Low } from "lowdb";
import { AppContext, Repository } from "./types.js";

type Schema = {
    repos: {
        [key: string]: Repository;
    }
}

export type Database = Low<Schema>;

export const loadDB = async (ctx: AppContext): Promise<Database> => {
    const db = await JSONFilePreset<Schema>(`${ctx.cachePath}/db.json`, { repos: {} });
    return db;
}
export const updateRepository = async (repoId: string, data: Partial<Repository>, db: Database) => {
    db.data.repos[repoId] = {
        ...db.data.repos[repoId],
        ...data,
    }
    await db.write();
}

export const createRepository = async (repo: Repository, db: Database) => {
    db.data.repos[repo.id] = repo;
    await db.write();
}