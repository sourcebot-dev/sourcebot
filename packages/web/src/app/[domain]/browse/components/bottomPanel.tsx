'use client';

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint";
import { Button } from "@/components/ui/button";
import { ResizablePanel } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { FaChevronDown } from "react-icons/fa";
import { VscReferences, VscSymbolMisc } from "react-icons/vsc";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useBrowseState } from "../hooks/useBrowseState";
import { ExploreMenu } from "@/ee/features/codeNav/components/exploreMenu";
import Link from "next/link";
import { useDomain } from "@/hooks/useDomain";
import { useRouter } from "next/navigation";

export const BOTTOM_PANEL_MIN_SIZE = 35;
export const BOTTOM_PANEL_MAX_SIZE = 65;
const CODE_NAV_DOCS_URL = "https://docs.sourcebot.dev/docs/features/code-navigation";

interface BottomPanelProps {
  order: number;
}

export const BottomPanel = ({ order }: BottomPanelProps) => {
  const panelRef = useRef<ImperativePanelHandle>(null);
  const hasCodeNavEntitlement = useHasEntitlement("code-nav");
  const domain = useDomain();
  const router = useRouter();

  const {
    state: { selectedSymbolInfo, isBottomPanelCollapsed, bottomPanelSize },
    updateBrowseState,
  } = useBrowseState();

  useEffect(() => {
    if (isBottomPanelCollapsed) {
      panelRef.current?.collapse();
    } else {
      panelRef.current?.expand();
    }
  }, [isBottomPanelCollapsed]);

  useHotkeys("shift+mod+e", (event) => {
    event.preventDefault();
    updateBrowseState({ isBottomPanelCollapsed: !isBottomPanelCollapsed });
  }, {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    description: "Open Explore Panel",
  });

  return (
    <>
      <div className="w-full flex flex-row justify-between">
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updateBrowseState({
                isBottomPanelCollapsed: !isBottomPanelCollapsed,
              })
            }}
          >
            <VscReferences className="w-4 h-4" />
            Explore
            <KeyboardShortcutHint shortcut="⇧ ⌘ E" />
          </Button>
        </div>

        {!isBottomPanelCollapsed && (
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
        {!hasCodeNavEntitlement ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <VscSymbolMisc className="w-6 h-6" />
            <p className="text-sm">
              Code navigation is not enabled for <span className="text-blue-500 hover:underline cursor-pointer" onClick={() => router.push(`/${domain}/settings/license`)}>your plan</span>.
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
        )}
      </ResizablePanel>
    </>
  )
}

