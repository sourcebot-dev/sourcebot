"use client"

import { useRouter } from "next/navigation"
import { XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function ErrorPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-8 px-8 flex flex-col items-center text-center">
          <div className="mb-6">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-8">Organization Creation Failed</h1>
          <p className="text-gray-400 mb-4">
            We encountered an error while creating your organization. Please try again.
          </p>
          <p className="text-gray-400 mb-8">
            If the problem persists, please contact us at team@sourcebot.dev
          </p>
          <Button
            onClick={() => router.push("/onboard")}
            className="px-6 py-2 h-auto text-base font-medium rounded-xl"
            variant="secondary"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

