import { JSONFilePreset } from "lowdb/node";
import { type Low } from "lowdb";
import { AppContext, Operation, Repository } from "./types.js";
import { v4 as uuid } from 'uuid';

type Schema = {
    repos: {
        [key: string]: Repository;
    },
    operations: {
        [key: string]: Operation;
    }
}

export type Database = Low<Schema>;

export const loadDB = async (ctx: AppContext): Promise<Database> => {
    const db = await JSONFilePreset<Schema>(`${ctx.cachePath}/db.json`, { repos: {}, operations: {} });
    return db;
}

export const updateOperation = async (id: string, data: Partial<Operation>, db: Database) => {
    db.data.operations[id] = {
        ...db.data.operations[id],
        ...data,
    }
    await db.write();
}

export const createOperation = async (data: Operation, db: Database) => {
    const id = uuid();
    db.data.operations[id] = data;
    await db.write();
    return id;
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