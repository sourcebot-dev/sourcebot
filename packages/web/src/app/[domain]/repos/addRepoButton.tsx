"use client"

import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { useState } from "react"
import { ConnectionList } from "../connections/components/connectionList"
import { useDomain } from "@/hooks/useDomain"
import Link from "next/link";
import { useSession } from "next-auth/react"

export function AddRepoButton() {
  const [isOpen, setIsOpen] = useState(false)
  const domain = useDomain()
  const { data: session, update } = useSession();

  // TODO(auth): Figure out how to handle conneciton list disabled case here in public access case
  return (
    <>
      {session?.user && (
        <>
          <Button
            onClick={() => setIsOpen(true)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle className="text-xl font-semibold">Add a New Repository</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Repositories are added to Sourcebot using <span className="text-primary">connections</span>. To add a new repo, add it to an existing connection or create a new one.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6">
                <ConnectionList className="w-full" isDisabled={false} />
              </div>
              <DialogFooter className="flex justify-between items-center border-t p-4 px-6">
                <Button asChild variant="default" className="bg-primary hover:bg-primary/90">
                  <Link href={`/${domain}/connections`}>Add new connection</Link>
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )
      }
    </>
  )
} 