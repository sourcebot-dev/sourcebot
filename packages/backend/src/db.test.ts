import { expect, test } from 'vitest';
import { migration_addFileLimitSize, migration_addSettings, Schema } from './db';
import { DEFAULT_SETTINGS } from './constants';
import { DeepPartial } from './types';


test('migration_addSettings adds the `settings` field with defaults if it does not exist', () => {
    const schema: DeepPartial<Schema> = {};

    const migratedSchema = migration_addSettings(schema as Schema);
    expect(migratedSchema).toStrictEqual({
        settings: DEFAULT_SETTINGS,
    });
});

test('migration_addFileLimitSize adds the `fileLimitSize` field with the default value if it does not exist', () => {
    const schema: DeepPartial<Schema> = {
        settings: {},
    }

    const migratedSchema = migration_addFileLimitSize(schema as Schema);
    expect(migratedSchema).toStrictEqual({
        settings: {
            fileLimitSize: DEFAULT_SETTINGS.fileLimitSize,
        }
    });
});

test('migration_addFileLimitSize will throw if `settings` is not defined', () => {
    const schema: DeepPartial<Schema> = {};
    expect(() => migration_addFileLimitSize(schema as Schema)).toThrow();
});