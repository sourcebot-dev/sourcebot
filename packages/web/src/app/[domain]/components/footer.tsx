import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
    return (
        <footer className="w-full mt-auto py-4 flex flex-row justify-center items-center gap-4">
        <Link href="https://sourcebot.dev" className="text-gray-400 text-sm hover:underline">About</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="https://github.com/sourcebot-dev/sourcebot/issues/new" className="text-gray-400 text-sm hover:underline">Support</Link>
        <Separator orientation="vertical" className="h-4" />
        <Link href="mailto:team@sourcebot.dev" className="text-gray-400 text-sm hover:underline">Contact Us</Link>
    </footer>
    )
}