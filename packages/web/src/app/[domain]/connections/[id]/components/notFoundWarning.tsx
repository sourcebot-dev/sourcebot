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
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 flex-shrink-0" />
        <p className="text-sm font-medium">
          This connection was unable to find some of the information you requested. Please ensure you&apos;ve provided the information listed below correctly, and that you&apos;ve provided a{" "}
          <button onClick={onSecretsClick} className="text-yellow-400 font-bold hover:underline">valid token</button>{" "}
          to access them if they&apos;re private.
        </p>
      </div>
      <ul className="mt-2 text-sm text-yellow-700">
        {notFound.users.length > 0 && (
          <li>
            <strong>Users:</strong> {notFound.users.join(', ')}
          </li>
        )}
        {notFound.orgs.length > 0 && (
          <li>
            <strong>{connectionType === "gitlab" ? "Groups" : "Organizations"}:</strong> {notFound.orgs.join(', ')}
          </li>
        )}
        {notFound.repos.length > 0 && (
          <li>
            <strong>{connectionType === "gitlab" ? "Projects" : "Repositories"}:</strong> {notFound.repos.join(', ')}
          </li>
        )}
      </ul>
      <RetrySyncButton connectionId={connectionId} domain={domain} />
    </div>
  )
}
