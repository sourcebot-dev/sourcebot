import { AlertTriangle } from "lucide-react"
import { Prisma } from "@sourcebot/db"
import { RetrySyncButton } from "./retrySyncButton"

interface NotFoundWarningProps {
  syncStatusMetadata: Prisma.JsonValue
  onSecretsClick: () => void
  connectionId: number
  domain: string
  connectionType: string
}

export const NotFoundWarning = ({ syncStatusMetadata, onSecretsClick, connectionId, domain, connectionType }: NotFoundWarningProps) => {
  if (!syncStatusMetadata || typeof syncStatusMetadata !== 'object' || !('notFound' in syncStatusMetadata)) {
    return null
  }

  const notFound = syncStatusMetadata.notFound as {
    users: string[]
    orgs: string[]
    repos: string[]
  }

  if (notFound.users.length === 0 && notFound.orgs.length === 0 && notFound.repos.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col items-start gap-3 border-2 border-yellow-500 bg-yellow-500/10 px-4 py-3 text-yellow-700">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 flex-shrink-0" />
        <h3 className="font-semibold">Unable to fetch all references</h3>
      </div>
      <p className="text-sm font-medium">
        Some requested references couldn&apos;t be found. Please ensure you&apos;ve provided the information listed below correctly, and that you&apos;ve provided a{" "}
        <button onClick={onSecretsClick} className="text-yellow-400 font-bold hover:underline">valid token</button>{" "}
        to access them if they&apos;re private.
      </p>
      <ul className="space-y-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3 mx-auto">
        {notFound.users.length > 0 && (
          <li className="flex items-center gap-2">
            <span className="font-medium">Users:</span>
            <span className="text-yellow-600">{notFound.users.join(', ')}</span>
          </li>
        )}
        {notFound.orgs.length > 0 && (
          <li className="flex items-center gap-2">
            <span className="font-medium">{connectionType === "gitlab" ? "Groups" : "Organizations"}:</span>
            <span className="text-yellow-600">{notFound.orgs.join(', ')}</span>
          </li>
        )}
        {notFound.repos.length > 0 && (
          <li className="flex items-center gap-2">
            <span className="font-medium">{connectionType === "gitlab" ? "Projects" : "Repositories"}:</span>
            <span className="text-yellow-600">{notFound.repos.join(', ')}</span>
          </li>
        )}
      </ul>
      <div className="mx-auto">
        <RetrySyncButton connectionId={connectionId} domain={domain} />
      </div>
    </div>
  )
}
