import { expect, test } from 'vitest';
import { DEFAULT_DB_DATA, migration_addDeleteStaleRepos, migration_addMaxFileSize, migration_addSettings, Schema } from './db';
import { DEFAULT_SETTINGS } from './constants';
import { DeepPartial } from './types';
import { Low } from 'lowdb';

class InMemoryAdapter<T> {
    private data: T;
    async read() {
        return this.data;
    }
    async write(data: T) {
        this.data = data;
    }
}

export const createMockDB = (defaultData: Schema = DEFAULT_DB_DATA) => {
    const db = new Low(new InMemoryAdapter<Schema>(), defaultData);
    return db;
}

test('migration_addSettings adds the `settings` field with defaults if it does not exist', () => {
    const schema: DeepPartial<Schema> = {};

    const migratedSchema = migration_addSettings(schema as Schema);
    expect(migratedSchema).toStrictEqual({
        settings: DEFAULT_SETTINGS,
    });
});

test('migration_addMaxFileSize adds the `maxFileSize` field with the default value if it does not exist', () => {
    const schema: DeepPartial<Schema> = {
        settings: {},
    }

    const migratedSchema = migration_addMaxFileSize(schema as Schema);
    expect(migratedSchema).toStrictEqual({
        settings: {
            maxFileSize: DEFAULT_SETTINGS.maxFileSize,
        }
    });
});

test('migration_addMaxFileSize will throw if `settings` is not defined', () => {
    const schema: DeepPartial<Schema> = {};
    expect(() => migration_addMaxFileSize(schema as Schema)).toThrow();
});

test('migration_addDeleteStaleRepos adds the `autoDeleteStaleRepos` field with the default value if it does not exist', () => {
    const schema: DeepPartial<Schema> = {
        settings: {
            maxFileSize: DEFAULT_SETTINGS.maxFileSize,
        },
    }

    const migratedSchema = migration_addDeleteStaleRepos(schema as Schema);
    expect(migratedSchema).toStrictEqual({
        settings: {
            maxFileSize: DEFAULT_SETTINGS.maxFileSize,
            autoDeleteStaleRepos: DEFAULT_SETTINGS.autoDeleteStaleRepos,
        }
    });
});