"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"

export function NoOrganizationCard() {
  const router = useRouter()

  const handleOnboard = () => {
    router.push("/onboard")
  }

  return (
    <div className="flex justify-center items-center p-4">
      <Card className="w-[400px] animate-fade-in-up">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <CardTitle>No Organization</CardTitle>
          </div>
          <CardDescription className="text-base">You&apos;re not part of any organization yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Please complete the onboarding process to create an organization. Alternatively, ask your teammate to invite
            you to their organization.
          </p>
          <p className="text-sm text-muted-foreground">
            Something seem wrong? Contact us at team@sourcebot.dev
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleOnboard} className="w-full bg-[#6366F1] hover:bg-[#5558DD]">
            Complete Onboarding
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

