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