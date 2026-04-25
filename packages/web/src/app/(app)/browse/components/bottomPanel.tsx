'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList } from "@/components/ui/tabs";
import { LowProfileTabsTrigger } from "@/components/ui/tab-switcher";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCallback, useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FaChevronDown } from "react-icons/fa";
import { VscReferences, VscSymbolMisc } from "react-icons/vsc";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useBrowseState } from "../hooks/useBrowseState";
import { useBrowseParams } from "../hooks/useBrowseParams";
import { getBrowsePath } from "../hooks/utils";
import { ExploreMenu } from "@/ee/features/codeNav/components/exploreMenu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import type { BrowseState } from "../browseStateProvider";
import { HistoryPanel } from "./historyPanel";
import { LatestCommitInfo } from "./latestCommitInfo";

export const BOTTOM_PANEL_MIN_SIZE = 35;
export const BOTTOM_PANEL_MAX_SIZE = 65;
const CODE_NAV_DOCS_URL = "https://docs.sourcebot.dev/docs/features/code-navigation";

interface BottomPanelProps {
    order: number;
}

type BottomPanelTab = BrowseState["activeBottomPanelTab"];

export const BottomPanel = ({ order }: BottomPanelProps) => {
    const panelRef = useRef<ImperativePanelHandle>(null);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");
    const router = useRouter();

    const {
        state: { selectedSymbolInfo, isBottomPanelCollapsed, bottomPanelSize, activeBottomPanelTab },
        updateBrowseState,
    } = useBrowseState();

    const { repoName, revisionName, path } = useBrowseParams();
    const fullHistoryHref = getBrowsePath({
        repoName,
        revisionName,
        path,
        pathType: 'commits',
    });

    useEffect(() => {
        if (isBottomPanelCollapsed) {
            panelRef.current?.collapse();
        } else {
            panelRef.current?.expand();
        }
    }, [isBottomPanelCollapsed]);

    const onTabClick = useCallback((tab: BottomPanelTab) => {
        if (isBottomPanelCollapsed) {
            updateBrowseState({ isBottomPanelCollapsed: false, activeBottomPanelTab: tab });
            return;
        }
        if (activeBottomPanelTab === tab) {
            updateBrowseState({ isBottomPanelCollapsed: true });
            return;
        }
        updateBrowseState({ activeBottomPanelTab: tab });
    }, [isBottomPanelCollapsed, activeBottomPanelTab, updateBrowseState]);

    useHotkeys("shift+mod+e", (event) => {
        event.preventDefault();
        onTabClick("explore");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open Explore Panel",
    });

    useHotkeys("shift+mod+h", (event) => {
        event.preventDefault();
        onTabClick("history");
    }, {
        enableOnFormTags: true,
        enableOnContentEditable: true,
        description: "Open History Panel",
    });

    // Empty value when collapsed so neither tab shows the active underline.
    const tabsValue = isBottomPanelCollapsed ? "" : activeBottomPanelTab;

    return (
        <>
            <div className="w-full flex flex-row justify-between pt-1 pr-1">
                <Tabs value={tabsValue}>
                    <TabsList className="h-auto p-0 bg-transparent">
                        <LowProfileTabsTrigger
                            value="history"
                            onClick={() => onTabClick("history")}
                            className="text-foreground"
                        >
                            <span className="flex flex-row items-center gap-2">
                                <History className="w-4 h-4" />
                                History
                                <KeyboardShortcutHint shortcut="shift+mod+h" />
                            </span>
                        </LowProfileTabsTrigger>
                        <LowProfileTabsTrigger
                            value="explore"
                            onClick={() => onTabClick("explore")}
                            className="text-foreground"
                        >
                            <span className="flex flex-row items-center gap-2">
                                <VscReferences className="w-4 h-4" />
                                Explore
                                <KeyboardShortcutHint shortcut="shift+mod+e" />
                            </span>
                        </LowProfileTabsTrigger>
                    </TabsList>
                </Tabs>

                {isBottomPanelCollapsed ? (
                    <div className="flex flex-row items-center min-w-0 px-2 self-center">
                        <LatestCommitInfo />
                    </div>
                ) : (
                    <div className="flex flex-row items-center gap-1 self-center">
                        {activeBottomPanelTab === "history" && (
                            <Button asChild variant="ghost" size="sm">
                                <Link
                                    href={fullHistoryHref}
                                    onClick={() => updateBrowseState({ isBottomPanelCollapsed: true })}
                                >
                                    <History className="w-4 h-4" />
                                    View full history
                                </Link>
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                updateBrowseState({ isBottomPanelCollapsed: true })
                            }}
                        >
                            <FaChevronDown className="w-4 h-4" />
                            Hide
                        </Button>
                    </div>
                )}
            </div>
            <Separator />
            <ResizablePanel
                minSize={BOTTOM_PANEL_MIN_SIZE}
                maxSize={BOTTOM_PANEL_MAX_SIZE}
                collapsible={true}
                ref={panelRef}
                defaultSize={isBottomPanelCollapsed ? 0 : bottomPanelSize}
                onCollapse={() => updateBrowseState({ isBottomPanelCollapsed: true })}
                onExpand={() => updateBrowseState({ isBottomPanelCollapsed: false })}
                onResize={(size) => {
                    if (!isBottomPanelCollapsed) {
                        updateBrowseState({ bottomPanelSize: size });
                    }
                }}
                order={order}
                id={"bottom-panel"}
            >
                {activeBottomPanelTab === "explore" ? (
                    !hasCodeNavEntitlement ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                            <VscSymbolMisc className="w-6 h-6" />
                            <p className="text-sm">
                                Code navigation is not enabled for <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => router.push(`/settings/license`)}>your plan</span>.
                            </p>

                            <Link
                                href={CODE_NAV_DOCS_URL}
                                target="_blank"
                                className="text-sm text-blue-500 hover:underline"
                            >
                                Learn more
                            </Link>
                        </div>
                    ) : !selectedSymbolInfo ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                            <VscSymbolMisc className="w-6 h-6" />
                            <p className="text-sm">No symbol selected</p>
                            <Link
                                href={CODE_NAV_DOCS_URL}
                                target="_blank"
                                className="text-sm text-blue-500 hover:underline"
                            >
                                Learn more
                            </Link>
                        </div>
                    ) : (
                        <ExploreMenu
                            selectedSymbolInfo={selectedSymbolInfo}
                        />
                    )
                ) : (
                    <HistoryPanel />
                )}
            </ResizablePanel>
        </>
    )
}
