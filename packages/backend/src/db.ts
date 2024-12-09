import { JSONFilePreset } from "lowdb/node";
import { type Low } from "lowdb";
import { AppContext, Repository, Settings } from "./types.js";
import { DEFAULT_SETTINGS } from "./constants.js";
import { createLogger } from "./logger.js";

const logger = createLogger('db');

export type Schema = {
    settings: Settings,
    repos: {
        [key: string]: Repository;
    }
}

export type Database = Low<Schema>;

export const loadDB = async (ctx: AppContext): Promise<Database> => {
    const db = await JSONFilePreset<Schema>(`${ctx.cachePath}/db.json`, {
        repos: {},
        settings: DEFAULT_SETTINGS,
    });

    await applyMigrations(db);

    return db;
}

export const updateRepository = async (repoId: string, data: Repository, db: Database) => {
    db.data.repos[repoId] = {
        ...db.data.repos[repoId],
        ...data,
    }
    await db.write();
}

export const updateSettings = async (settings: Settings, db: Database) => {
    db.data.settings = settings;
    await db.write();
}

export const createRepository = async (repo: Repository, db: Database) => {
    db.data.repos[repo.id] = repo;
    await db.write();
}

export const applyMigrations = async (db: Database) => {
    const log = (name: string) => {
        logger.info(`Applying migration '${name}'`);
    }

    await db.update((schema) => {
        schema = migration_addSettings(schema, log);
        schema = migration_addFileLimitSize(schema, log);
        return schema;
    });
}

/**
 * @todo: add link to PR that adds this migration
 */
export const migration_addSettings = (schema: Schema, log?: (name: string) => void) => {
    if (!schema.settings) {
        log?.("addSettings");
        schema.settings = DEFAULT_SETTINGS;
    }

    return schema;
}

/**
 * @todo: add link to PR that adds this migration
 */
export const migration_addFileLimitSize = (schema: Schema, log?: (name: string) => void) => {
    if (!schema.settings.fileLimitSize) {
        log?.("addFileLimitSize");
        schema.settings.fileLimitSize = DEFAULT_SETTINGS.fileLimitSize;
    }

    return schema;
}