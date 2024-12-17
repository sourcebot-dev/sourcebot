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

export const DEFAULT_DB_DATA: Schema = {
    repos: {},
    settings: DEFAULT_SETTINGS,
}

export type Database = Low<Schema>;

export const loadDB = async (ctx: AppContext): Promise<Database> => {
    const db = await JSONFilePreset<Schema>(`${ctx.cachePath}/db.json`, DEFAULT_DB_DATA);

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
        // @NOTE: please ensure new migrations are added after older ones!
        schema = migration_addSettings(schema, log);
        schema = migration_addMaxFileSize(schema, log);
        schema = migration_addDeleteStaleRepos(schema, log);
        schema = migration_addReindexInterval(schema, log);
        schema = migration_addResyncInterval(schema, log);
        return schema;
    });
}

/**
 * @see: https://github.com/sourcebot-dev/sourcebot/pull/118
 */
export const migration_addSettings = (schema: Schema, log?: (name: string) => void) => {
    if (!schema.settings) {
        log?.("addSettings");
        schema.settings = DEFAULT_SETTINGS;
    }

    return schema;
}

/**
 * @see: https://github.com/sourcebot-dev/sourcebot/pull/118
 */
export const migration_addMaxFileSize = (schema: Schema, log?: (name: string) => void) => {
    if (!schema.settings.maxFileSize) {
        log?.("addMaxFileSize");
        schema.settings.maxFileSize = DEFAULT_SETTINGS.maxFileSize;
    }

    return schema;
}

/**
 * @see: https://github.com/sourcebot-dev/sourcebot/pull/128
 */
export const migration_addDeleteStaleRepos = (schema: Schema, log?: (name: string) => void) => {
    if (schema.settings.autoDeleteStaleRepos === undefined) {
        log?.("addDeleteStaleRepos");
        schema.settings.autoDeleteStaleRepos = DEFAULT_SETTINGS.autoDeleteStaleRepos;
    }

    return schema;
}

/**
 * @see: https://github.com/sourcebot-dev/sourcebot/pull/134
 */
export const migration_addReindexInterval = (schema: Schema, log?: (name: string) => void) => {
    if (schema.settings.reindexInterval === undefined) {
        log?.("addReindexInterval");
        schema.settings.reindexInterval = DEFAULT_SETTINGS.reindexInterval;
    }

    return schema;
}

/**
 * @see: https://github.com/sourcebot-dev/sourcebot/pull/134
 */
export const migration_addResyncInterval = (schema: Schema, log?: (name: string) => void) => {
    if (schema.settings.resyncInterval === undefined) {
        log?.("addResyncInterval");
        schema.settings.resyncInterval = DEFAULT_SETTINGS.resyncInterval;
    }

    return schema;
}