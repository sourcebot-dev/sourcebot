import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import { EnterpriseContactUsButton } from "./enterpriseContactUsButton"
import { CheckoutButton } from "./checkoutButton"
import { SourcebotLogo } from "@/app/components/sourcebotLogo";

const teamFeatures = [
  "Index hundreds of repos from multiple code hosts (GitHub, GitLab, Gerrit, Gitea, etc.). Self-hosted code sources supported",
  "Public and private repos supported",
  "Create sharable links to code snippets",
  "9x5 email support team@sourcebot.dev",
]

const enterpriseFeatures = [
  "All Team features",
  "Dedicated Slack support channel",
  "Single tenant deployment",
  "Advanced security features",
]

export async function PaywallCard({ domain }: { domain: string }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="max-h-44 w-auto mb-4 flex justify-center">
        <SourcebotLogo
          className="h-18 md:h-40"
          size="large"
        />
      </div>
      <h2 className="text-3xl font-bold text-center mb-8 text-primary">
        Your subscription has expired.
      </h2>
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-2 border-primary/20 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-primary/50 flex flex-col">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-primary">Team</CardTitle>
            <CardDescription className="text-base">For professional developers and small teams</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="mb-4">
              <p className="text-4xl font-bold text-primary">$10</p>
              <p className="text-sm text-muted-foreground">per user / month</p>
            </div>
            <ul className="space-y-3">
              {teamFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="mr-3 h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <CheckoutButton domain={domain} />
          </CardFooter>
        </Card>
        <Card className="border-2 border-primary/20 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-primary/50 flex flex-col">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-primary">Enterprise</CardTitle>
            <CardDescription className="text-base">For large organizations with custom needs</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="mb-4">
              <p className="text-4xl font-bold text-primary">Custom</p>
              <p className="text-sm text-muted-foreground">tailored to your needs</p>
            </div>
            <ul className="space-y-3">
              {enterpriseFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="mr-3 h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <EnterpriseContactUsButton />
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
