import { Connection, Repo, RepoToConnection } from "@sourcebot/db";
import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";

export type Settings = Required<SettingsSchema>;

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type RepoWithConnections = Repo & { connections: (RepoToConnection & { connection: Connection })[] };


export type RepoAuthCredentials = {
    hostUrl?: string;
    token: string;
    cloneUrlWithToken?: string;
    authHeader?: string;
}