import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import { EnterpriseContactUsButton } from "./enterpriseContactUsButton"
import { CheckoutButton } from "./checkoutButton"

const proFeatures = [
    "Unlimited projects",
    "Priority support",
    "Advanced analytics",
    "Custom integrations",
    "Team collaboration tools",
  ]
  
  const enterpriseFeatures = [
    "All Pro features",
    "Dedicated account manager",
    "Custom SLA",
    "On-premise deployment option",
    "Advanced security features",
  ]

export function PaywallCard({ orgId }: { orgId: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>For professional developers and small teams</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">$10</p>
          <p className="text-sm text-muted-foreground">per user / month</p>
          <ul className="mt-4 space-y-2">
            {proFeatures.map((feature, index) => (
              <li key={index} className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <CheckoutButton orgId={orgId} />
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Enterprise</CardTitle>
          <CardDescription>For large organizations with custom needs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">Custom</p>
          <p className="text-sm text-muted-foreground">tailored to your needs</p>
          <ul className="mt-4 space-y-2">
            {enterpriseFeatures.map((feature, index) => (
              <li key={index} className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <EnterpriseContactUsButton />
        </CardFooter>
      </Card>
    </div>
  )
}

