"use client"

import Link from "next/link"
import { Shield, Lock, CheckCircle, ExternalLink, Mail } from "lucide-react"
import useCaptureEvent from "@/hooks/useCaptureEvent"

export default function SecurityCard() {
  const captureEvent = useCaptureEvent();

  return (
    <div className="mt-12 max-w-md mx-auto text-center">
      <div className="bg-backgroundSecondary border border-[#1E2A3A] rounded-lg p-6 shadow-lg">
        <div className="flex justify-center mb-4">
          <Shield className="h-10 w-10 text-[#9D5CFF]" />
        </div>
        <h3 className="text-xl font-semibold mb-3">Multi-Layered Security</h3>
        <p className="text-[#A1A1AA] mb-6">
          Your code and secrets are protected through comprehensive security measures. We implement robust encryption,
          secure storage, and strict access controls to safeguard your data at every step.
        </p>

        <div className="space-y-4 mb-5">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-[#9D5CFF] mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-foregroundSecondary text-left">
              All data is stored on Google Cloud Platform in the United States (us-west-1)
            </span>
          </div>

          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-[#9D5CFF] mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-foregroundSecondary text-left">
              All data is encrypted in transit using TLS 1.2+, and at rest using AES-256
            </span>
          </div>

          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-[#9D5CFF] mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-foregroundSecondary text-left">
              <div className="flex items-center">
                <span>Sourcebot is fully open-source, and is trusted by thousands of developers</span>
                <Link
                  href="https://github.com/sourcebot-dev/sourcebot"
                  target="_blank"
                  className="inline-flex items-center ml-2 text-[#9D5CFF] hover:text-[#B47EFF] transition-colors"
                >
                  <svg
                    className="h-4 w-4 mr-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-[#A1A1AA] mb-5">
          Have questions?
          <Link
            href="mailto:team@sourcebot.dev"
            className="inline-flex items-center ml-2 text-[#9D5CFF] hover:text-[#B47EFF] transition-colors"
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            <span>Get in touch</span>
          </Link>
        </div>

        <Link
          href="https://sourcebot.dev/security"
          target="_blank"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-backgroundSecondary border border-[#1E2A3A] text-foreground hover:bg-backgroundSecondary/80 transition-colors"
          onClick={() => captureEvent('wa_security_page_click', {})}
        >
          <Lock className="h-4 w-4 mr-2" />
          <span>Learn about our security measures</span>
        </Link>
      </div>
    </div>
  )
}

