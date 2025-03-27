"use client"

import { useRouter } from "next/navigation"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TabSwitcherProps {
  tabs: { value: string; label: string }[]
  currentTab: string
  className?: string
}

export function TabSwitcher({ tabs, currentTab, className }: TabSwitcherProps) {
  const router = useRouter()

  const handleTabChange = (value: string) => {
    router.push(`?tab=${value}`, { scroll: false })
  }

  return (
    <TabsList className={className}>
      {tabs.map((tab) => (
        <LowProfileTabsTrigger
          key={tab.value}
          value={tab.value}
          onClick={() => handleTabChange(tab.value)}
          data-state={currentTab === tab.value ? "active" : ""}
        >
          {tab.label}
        </LowProfileTabsTrigger>
      ))}
    </TabsList>
  )
}

interface LowProfileTabsTrigger {
    value: string
    children: React.ReactNode
    onClick?: () => void
  }
  
  export function LowProfileTabsTrigger({ value, children, onClick }: LowProfileTabsTrigger) {
    return (
      <TabsTrigger
        value={value}
        onClick={onClick}
        className="relative h-9 rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 font-normal text-muted-foreground transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent"
      >
        {children}
      </TabsTrigger>
    )
  }
  
  