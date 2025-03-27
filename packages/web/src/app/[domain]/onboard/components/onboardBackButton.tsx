import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface BackButtonProps {
  onClick: () => void
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="text-gray-400 hover:text-white hover:bg-gray-800 focus-visible:ring-offset-gray-900 h-8 px-3 rounded-md"
      >
        <ArrowLeft size={16} className="mr-1" />
        <span>Back</span>
      </Button>
    </div>
  )
}

