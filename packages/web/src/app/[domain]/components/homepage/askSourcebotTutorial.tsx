"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ModelProviderLogo } from "@/features/chat/components/chatBox/modelProviderLogo"
import { cn } from "@/lib/utils"
import githubIcon from "@/public/github.svg"
import { ChevronLeft, ChevronRight, GitBranch, LibraryBigIcon, ScanSearchIcon, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

interface TutorialModalProps {
    isOpen: boolean
    onClose: () => void
}

const tutorialSteps = [
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 justify-between gap-4">
                <div className="flex flex-col gap-6">
                    <h2 className="text-5xl font-bold leading-tight">
                        Ask Source<span className="text-[#851EE6]">bot.</span>
                    </h2>
                    <p className="text-lg">
                        Ask questions about your <span className="font-bold">entire codebase</span> in natural language.
                        Get back Markdown formatted responses with <span className="font-bold">inline citations</span>.
                    </p>
                    <p className="text-md text-muted-foreground">
                        Ask Sourcebot is an agentic search tool that can answer questions about your codebase by searching, reading files, navigating references, and more. Supports any <Link href="https://docs.sourcebot.dev/docs/configuration/language-model-providers" className="underline">compatible LLM.</Link>
                    </p>
                </div>
                <div className="space-y-3 mx-auto flex flex-wrap justify-center gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <ModelProviderLogo provider="anthropic" />
                        <ModelProviderLogo provider="openai" />
                        <ModelProviderLogo provider="google-generative-ai" />
                        <ModelProviderLogo provider="amazon-bedrock" />
                        <ModelProviderLogo provider="azure" />
                        <ModelProviderLogo provider="deepseek" />
                        <ModelProviderLogo provider="mistral" />
                        <ModelProviderLogo provider="openrouter" />
                        <ModelProviderLogo provider="xai" />
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <div className="h-full w-full">
                <video
                    src="https://storage.googleapis.com/sourcebot-assets/hero_final.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                />
            </div>
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full p-8 space-y-6">
                <h2 className="text-3xl font-bold leading-tight flex items-center gap-2">
                    <ScanSearchIcon className="inline-block h-8 w-8 text-primary" />
                    Search Scopes
                </h2>
                <p className="text-lg">
                    {`When asking Sourcebot a question, you can select one or more scopes to constrain the search.`}
                </p>

                <div className="flex flex-col mb-2">
                    <p className="mb-4">There are two types of search scopes:</p>
                    <div className="flex gap-2">
                        <Image src={githubIcon} alt="GitHub icon" className="w-4 h-4 dark:invert mt-1" />
                        <span><strong>Repository</strong>: A single repository, indicated by the code host icon.</span>
                    </div>
                    <div className="flex gap-2">
                        <LibraryBigIcon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                        <span><strong>Reposet</strong>: A set of repositories, indicated by the library icon.</span>
                    </div>
                </div>
            </div>
        ),
        rightContent: (
            <div>
                todo
            </div>
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full justify-between p-8">

            </div>
        ),
        rightContent: (
            <div className="flex items-center justify-center h-full p-8">
                <Card className="w-full max-w-md border-2 border-primary bg-accent shadow-lg">
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <GitBranch className="w-4 h-4" />
                                Context dropdown:
                            </div>
                            <div className="bg-card rounded-lg p-4 border">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                                    <span className="text-base font-medium">my-frontend-app</span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                </div>
                                <div className="mt-3 pl-5 space-y-1">
                                    <div className="text-sm text-muted-foreground">• backend-api</div>
                                    <div className="text-sm text-muted-foreground">• mobile-app</div>
                                    <div className="text-sm text-muted-foreground">• shared-components</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        ),
    },
    {
        leftContent: (
            <div className="flex flex-col h-full justify-between p-8">
                <p>todo</p>
            </div>
        ),
        rightContent: (
            <div>
                todo
            </div>
        ),
    },
]

export function AskSourcebotTutorial({ isOpen, onClose }: TutorialModalProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const nextStep = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleClose = () => {
        setCurrentStep(0)
        onClose()
    }

    const isLastStep = currentStep === tutorialSteps.length - 1
    const isFirstStep = currentStep === 0

    const currentStepData = tutorialSteps[currentStep]

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                className="sm:max-w-[900px] p-0 flex flex-col h-[525px] overflow-hidden rounded-xl border-none bg-transparent"
                closeButtonClassName="text-white"
            >
                <div className="relative flex h-full">
                    {/* Left Column (Text Content & Navigation) */}
                    <div className="flex-1 flex flex-col justify-between bg-background">
                        <div className="p-4 flex-1 overflow-y-auto">
                            {currentStepData.leftContent}
                        </div>

                        {/* Fixed bottom navigation for left column */}
                        <div className="border-t p-6 flex items-center justify-between">
                            {/* Left side: Previous button container */}
                            <div className="w-36 flex justify-start">
                                <Button
                                    variant="ghost"
                                    onClick={prevStep}
                                    className={cn(
                                        "flex items-center gap-2",
                                        isFirstStep && "opacity-0 pointer-events-none"
                                    )}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </Button>
                            </div>

                            {/* Center: Progress dots */}
                            <div className="flex gap-2">
                                {tutorialSteps.map((_, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "w-2 h-2 rounded-full transition-colors",
                                            index === currentStep ? "bg-primary" : "bg-muted"
                                        )}
                                    />
                                ))}
                            </div>

                            {/* Right side: Next/Start/Get Started button container */}
                            <div className="w-36 flex justify-end">
                                {isLastStep ? (
                                    <Button onClick={handleClose}>
                                        Get Started
                                        <Sparkles className="w-4 h-4" />
                                    </Button>
                                ) : (
                                    <Button onClick={nextStep}>
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Image/Visual Content) */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div className="flex-1 overflow-y-auto">{currentStepData.rightContent}</div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
