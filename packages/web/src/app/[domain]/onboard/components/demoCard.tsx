"use client"

import { ExternalLink } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import useCaptureEvent from "@/hooks/useCaptureEvent"

export default function DemoCard() {
  const captureEvent = useCaptureEvent();

  return (
    <Card className="mb-6 w-full border bg-card text-card-foreground">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">New to Sourcebot?</h3>
              <p className="text-xs text-muted-foreground">Try our public demo before creating an account</p>
            </div>

            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link 
                href="https://sourcebot.dev/search" 
                target="_blank" 
                className="flex items-center gap-1.5"
                onClick={() => captureEvent('wa_demo_card_click', {})}
              >
                Try demo
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
