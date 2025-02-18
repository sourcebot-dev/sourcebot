"use client"

import { BackendError } from "@sourcebot/error";
import { Prisma } from "@sourcebot/db";

export function DisplayConnectionError({ syncStatusMetadata, onSecretsClick }: { syncStatusMetadata: Prisma.JsonValue, onSecretsClick: () => void }) {
  const errorCode = syncStatusMetadata && typeof syncStatusMetadata === 'object' && 'error' in syncStatusMetadata
    ? (syncStatusMetadata.error as string)
    : undefined;

  switch (errorCode) {
    case BackendError.CONNECTION_SYNC_INVALID_TOKEN:
      return <InvalidTokenError syncStatusMetadata={syncStatusMetadata} onSecretsClick={onSecretsClick} />
    case BackendError.CONNECTION_SYNC_SECRET_DNE:
      return <SecretNotFoundError syncStatusMetadata={syncStatusMetadata} onSecretsClick={onSecretsClick} />
    case BackendError.CONNECTION_SYNC_SYSTEM_ERROR:
      return <SystemError />
    case BackendError.CONNECTION_SYNC_FAILED_TO_FETCH_GERRIT_PROJECTS:
      return <FailedToFetchGerritProjects syncStatusMetadata={syncStatusMetadata} />
    default:
      return <UnknownError />
  }
}

function SecretNotFoundError({ syncStatusMetadata, onSecretsClick }: { syncStatusMetadata: Prisma.JsonValue, onSecretsClick: () => void }) {
  const secretKey = syncStatusMetadata && typeof syncStatusMetadata === 'object' && 'secretKey' in syncStatusMetadata
    ? (syncStatusMetadata.secretKey as string)
    : undefined;

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">Secret Not Found</h4>
      <p className="text-sm text-muted-foreground">
        The secret key provided for this connection was not found. Please ensure your config is referencing a secret
        that exists in your{" "}
        <button onClick={onSecretsClick} className="text-primary hover:underline">
          organization&apos;s secrets
        </button>
        , and try again.
      </p>
      {secretKey && (
        <p className="text-sm text-muted-foreground">
          Secret Key: <span className="text-red-500">{secretKey}</span>
        </p>
      )}
    </div>
  );
}

function InvalidTokenError({ syncStatusMetadata, onSecretsClick }: { syncStatusMetadata: Prisma.JsonValue, onSecretsClick: () => void }) {
  const secretKey = syncStatusMetadata && typeof syncStatusMetadata === 'object' && 'secretKey' in syncStatusMetadata
    ? (syncStatusMetadata.secretKey as string)
    : undefined;

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">Invalid Authentication Token</h4>
      <p className="text-sm text-muted-foreground">
        The authentication token provided for this connection is invalid. Please update your config with a valid token and try again.
      </p>
      {secretKey && (
        <p className="text-sm text-muted-foreground">
          Secret Key: <button onClick={onSecretsClick} className="text-red-500 hover:underline">{secretKey}</button>
        </p>
      )}
    </div>
  );
}

function SystemError() {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">System Error</h4>
      <p className="text-sm text-muted-foreground">
        An error occurred while syncing this connection. Please try again later.
      </p>
    </div>
  )
}

function FailedToFetchGerritProjects({ syncStatusMetadata }: { syncStatusMetadata: Prisma.JsonValue}) {
  const status = syncStatusMetadata && typeof syncStatusMetadata === 'object' && 'status' in syncStatusMetadata
    ? (syncStatusMetadata.status as number)
    : undefined;

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">Failed to Fetch Gerrit Projects</h4>
      <p className="text-sm text-muted-foreground">
        An error occurred while syncing this connection. Please try again later.
      </p>
      {status && (
        <p className="text-sm text-muted-foreground">
          Status: <span className="text-red-500">{status}</span>
        </p>
      )}
    </div>
  )
}

function UnknownError() {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">Unknown Error</h4>
      <p className="text-sm text-muted-foreground">
        An unknown error occurred while syncing this connection. Please try again later.
      </p>
    </div>
  )
}
