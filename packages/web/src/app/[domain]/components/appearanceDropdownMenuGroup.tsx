'use client';

import {
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu"
import { useKeymapType } from "@/hooks/useKeymapType"
import { KeymapType } from "@/lib/types"
import {
    CodeIcon,
    Laptop,
    Moon,
    Sun
} from "lucide-react"
import { useTheme } from "next-themes"
import { useMemo } from "react"

export const AppearanceDropdownMenuGroup = () => {
    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();

    const theme = useMemo(() => {
        return _theme ?? "light";
    }, [_theme]);

    const ThemeIcon = useMemo(() => {
        switch (theme) {
            case "light":
                return <Sun className="h-4 w-4 mr-2" />;
            case "dark":
                return <Moon className="h-4 w-4 mr-2" />;
            case "system":
                return <Laptop className="h-4 w-4 mr-2" />;
            default:
                return <Laptop className="h-4 w-4 mr-2" />;
        }
    }, [theme]);

    return (
        <DropdownMenuGroup>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    {ThemeIcon}
                    <span>Theme</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                            <DropdownMenuRadioItem value="light">
                                Light
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">
                                Dark
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="system">
                                System
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                    <CodeIcon className="h-4 w-4 mr-2" />
                    <span>Code navigation</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={keymapType} onValueChange={(value) => setKeymapType(value as KeymapType)}>
                            <DropdownMenuRadioItem value="default">
                                Default
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="vim">
                                Vim
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuPortal>
            </DropdownMenuSub>
        </DropdownMenuGroup>
    )
}