"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, Mail } from "lucide-react"

export function AnalyticsEntitlementMessage() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] py-12">
            <Card className="w-full max-w-lg bg-slate-900 border-slate-800 shadow-xl p-2">
                <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-slate-800">
                            <BarChart3 className="h-8 w-8 text-slate-400" />
                        </div>
                    </div>
                    <CardTitle className="text-xl font-semibold text-white">
                        Analytics is an Enterprise Feature
                    </CardTitle>
                    <CardDescription className="text-slate-400 mt-2">
                        Get insights into your organization&apos;s usage patterns and user activity with our analytics dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-sm text-slate-300">
                            Want to try out Sourcebot&apos;s enterprise features? Reach out to us and we&apos;ll get back to you within
                            a couple hours with a trial license.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button asChild className="w-full">
                            <a 
                                href="https://sourcebot.dev/contact" 
                                target="_blank" 
                                rel="noopener"
                            >
                                <Mail className="h-4 w-4 mr-2" />
                                Request a trial license
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
} 