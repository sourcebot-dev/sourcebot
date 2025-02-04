import { NotFound } from "./notFound"

export const PageNotFound = () => {
    return (
        <div className="flex h-screen">
            <NotFound message="Page not found" />
        </div>
    )
}