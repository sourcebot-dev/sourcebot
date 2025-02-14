"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import Image from "next/image";

import { setupInitialStripeCustomer } from "../../../actions"
import {
    EmbeddedCheckout,
    EmbeddedCheckoutProvider
  } from '@stripe/react-stripe-js'
  import { loadStripe } from '@stripe/stripe-js'
import { useState } from "react";
import { OnboardingFormValues } from "./orgCreateForm";
import { isServiceError } from "@/lib/utils";
import { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY } from "@/lib/environment.client";

const stripePromise = loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function TrialCard({ orgCreateInfo }: { orgCreateInfo: OnboardingFormValues }) {
  const [trialAck, setTrialAck] = useState(false);

  return (
    <div>
    {trialAck ? (
        <div id="checkout">
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ fetchClientSecret: async () => {
            const clientSecret = await setupInitialStripeCustomer(orgCreateInfo.name, orgCreateInfo.domain);
            if (isServiceError(clientSecret)) {
              throw clientSecret;
            }
            return clientSecret;
          } }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
        </div>
      ) :
      <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Image
                src={logoDark || "/placeholder.svg"}
                className="h-16 w-auto hidden dark:block"
                alt="Sourcebot logo"
                priority={true}
              />
              <Image
                src={logoLight || "/placeholder.svg"}
                className="h-16 w-auto block dark:hidden"
                alt="Sourcebot logo"
                priority={true}
              />
            </div>
            <CardTitle className="text-center text-2xl font-bold">7 day free trial</CardTitle>
            <CardDescription className="text-center mt-2">Cancel anytime. No credit card required.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="space-y-4 mb-6">
              {[
                "Blazingly fast code search",
                "Index hundreds of repos from multiple code hosts (GitHub, GitLab, Gerrit, Gitea, etc.). Self-hosted code sources supported.",
                "Public and private repos supported.",
                "Create sharable links to code snippets.",
                "Powerful regex and symbol search",
              ].map((feature, index) => (
                <li key={index} className="flex items-center">
                  <div className="mr-3 flex-shrink-0">
                    <Check className="h-5 w-5 text-sky-500" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{feature}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-center mt-8">
              <Button onClick={() => setTrialAck(true)} className="px-8 py-2">
                Start trial
              </Button>
            </div>
          </CardContent>
        </Card>
    }
    </div>
  )
}
