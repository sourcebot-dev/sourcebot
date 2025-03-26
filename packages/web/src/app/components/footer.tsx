import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
    return (
        <footer className="w-full mt-auto py-4 flex flex-row justify-center items-center gap-4">
        <Link href="https://sourcebot.dev" className="text-gray-400 text-sm hover:underline">About</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://sourcebot.dev/terms" className="text-gray-400 text-sm hover:underline">Terms</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://sourcebot.dev/security" className="text-gray-400 text-sm hover:underline">Security</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://www.sourcebot.dev/contact" target="_blank" className="text-gray-400 text-sm hover:underline">Contact Us</Link>
    </footer>
    )
}