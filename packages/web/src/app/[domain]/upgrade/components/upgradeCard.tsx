'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2 } from "lucide-react";


interface UpgradeCardProps {
    title: string;
    description: string;
    price: string;
    priceDescription: string;
    features: string[];
    buttonText: string;
    onClick?: () => void;
    isLoading?: boolean;
}

export const UpgradeCard = ({ title, description, price, priceDescription, features, buttonText, onClick, isLoading = false }: UpgradeCardProps) => {
    return (
        <Card
            className="transition-all duration-300 hover:border-primary/50  cursor-pointer flex flex-col h-full"
            onClick={() => onClick?.()}
        >
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-primary">{title}</CardTitle>
                <CardDescription className="text-base">{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow mb-4">
                <div className="mb-6">
                    <p className="text-4xl font-bold text-primary">{price}</p>
                    <p className="text-sm text-muted-foreground">{priceDescription}</p>
                </div>
                <ul className="space-y-3">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                            <Check className="mr-3 h-5 w-5 text-green-500 flex-shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter>
                <Button
                    className="w-full"
                    onClick={() => onClick?.()}
                    disabled={isLoading}
                >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {buttonText}
                </Button>
            </CardFooter>
        </Card>
    )
}