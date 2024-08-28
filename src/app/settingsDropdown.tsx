import {
    CodeIcon,
    Laptop,
    Moon,
    Settings,
    Sun
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { useMemo } from "react"
import { KeymapType } from "@/lib/types"

interface SettingsDropdownProps {
    keymapType: KeymapType;
    onKeymapTypeChange: (keymapType: KeymapType) => void;
}

export const SettingsDropdown = ({
    keymapType,
    onKeymapTypeChange,
}: SettingsDropdownProps) => {

    const { theme: _theme, setTheme } = useTheme();
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                                <DropdownMenuRadioGroup value={keymapType} onValueChange={(value) => onKeymapTypeChange(value as KeymapType)}>
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
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
