"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Code, Database, Search } from "lucide-react"
import useCaptureEvent from "@/hooks/useCaptureEvent"

export default function RegistrationCard() {
  const [isHovered, setIsHovered] = useState(false)
  const captureEvent = useCaptureEvent()

  return (
    <Card
      className="w-full max-w-md mx-auto border shadow-lg overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold mt-2">Try Sourcebot Cloud</CardTitle>
        <CardDescription>Index and search your own code repositories</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start">
            <Search className="h-5 w-5 mr-3 text-primary" />
            <p className="text-sm">Search your private and public repositories</p>
          </div>
          <div className="flex items-start">
            <Database className="h-5 w-5 mr-3 text-primary" />
            <p className="text-sm">Index your own codebase in minutes</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3 pt-0">
        <Link href="https://app.sourcebot.dev" className="w-full" rel="noopener noreferrer" onClick={() => captureEvent("wa_demo_try_card_pressed", {})}>
          <Button className={`w-full transition-all duration-300 ${isHovered ? "translate-y-[-2px]" : ""}`}>
            Try With Your Code
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <p className="text-xs text-center text-muted-foreground">
            14 day free trial. No credit card required.
        </p>
      </CardFooter>
    </Card>
  )
}
