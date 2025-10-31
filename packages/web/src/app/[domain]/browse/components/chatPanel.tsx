'use client'

import { KeyboardShortcutHint } from "@/app/components/keyboardShortcutHint"
import { Button } from "@/components/ui/button"
import { RiRobot3Line } from "react-icons/ri";
import { useBrowseState } from "../hooks/useBrowseState";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Separator } from "@/components/ui/separator";
import { ResizablePanel } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const CHAT_PANEL_MIN_SIZE = 5;
export const CHAT_PANEL_MAX_SIZE = 50;

interface ChatPanelProps {
  order: number;
}

export const ChatPanel = ({ order }: ChatPanelProps) => {
  const panelRef = useRef<ImperativePanelHandle>(null);
  const {
    state: { isChatPanelCollapsed, chatPanelSize },
    updateBrowseState
  } = useBrowseState();

  useEffect(() => {
    if (isChatPanelCollapsed) {
      panelRef.current?.collapse();
    } else {
      panelRef.current?.expand();
    }
  }, [isChatPanelCollapsed]);

  useHotkeys("shift+mod+o", (event) => {
    event.preventDefault();
    updateBrowseState({ isChatPanelCollapsed: !isChatPanelCollapsed });
  }, {
    enableOnFormTags: true,
    enableOnContentEditable: true,
    description: "Open Chat Panel"
  });

  return (
    <>
      <ResizablePanel
        minSize={CHAT_PANEL_MIN_SIZE}
        maxSize={CHAT_PANEL_MAX_SIZE}
        collapsible={true}
        ref={panelRef}
        defaultSize={isChatPanelCollapsed ? 0 : chatPanelSize}
        onCollapse={() => updateBrowseState({ isChatPanelCollapsed: true })}
        onExpand={() => updateBrowseState({ isChatPanelCollapsed: false })}
        onResize={(size) => {
          if (!isChatPanelCollapsed) {
            updateBrowseState({ chatPanelSize: size });
          }
        }}
        order={order}
        id={"chat-panel"}
      >
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
          <p className="text-sm">Chat goes here</p>
        </div>
      </ResizablePanel>
      {isChatPanelCollapsed && (
        <div className="flex flex-col items-center h-full p-2">
          <Tooltip
            delayDuration={100}
          >
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  panelRef.current?.expand();
                }}
              >
                <RiRobot3Line className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-row items-center gap-2">
              <KeyboardShortcutHint shortcut="⇧ ⌘ O" />
              <Separator orientation="vertical" className="h-4" />
              <span>Open AI Chat</span>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </>
  )
}
