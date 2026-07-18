"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

// Base UI unmounts the Popup the instant `open` goes false, which would kill a GSAP exit tween
// mid-flight — there'd be nothing left in the DOM to animate. `actionsRef` + `preventUnmountOnClose`
// is Base UI's documented escape hatch for exactly this: the Popup stays mounted (still receiving
// `open`, now false) until something calls `actions.unmount()`, so DialogContent can play its own
// GSAP exit tween on the way out and unmount only once that tween completes. The open flag itself is
// threaded through context since Dialog (Root) and DialogContent are composed separately by callers.
const DialogAnimationContext = React.createContext<{
  open: boolean
  actionsRef: React.RefObject<DialogPrimitive.Root.Actions | null>
} | null>(null)

function Dialog({ open, onOpenChange, ...props }: DialogPrimitive.Root.Props) {
  const actionsRef = React.useRef<DialogPrimitive.Root.Actions>(null)
  return (
    <DialogAnimationContext.Provider value={{ open: !!open, actionsRef }}>
      <DialogPrimitive.Root
        data-slot="dialog"
        open={open}
        actionsRef={actionsRef}
        onOpenChange={(nextOpen, eventDetails) => {
          if (!nextOpen) eventDetails.preventUnmountOnClose()
          onOpenChange?.(nextOpen, eventDetails)
        }}
        {...props}
      />
    </DialogAnimationContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/80 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  const ctx = React.useContext(DialogAnimationContext)

  // Entrance: Base UI's Popup only mounts once the dialog opens, so a plain mount-time tween is all
  // a fresh open needs — no state tracking required.
  useGSAP(() => {
    if (!popupRef.current) return
    gsap.fromTo(
      popupRef.current,
      { opacity: 0, scale: 0.94, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power3.out" }
    )
  }, [])

  // Exit: fires when the Dialog wrapper's `open` flips to false. The Popup is still mounted at this
  // point (see preventUnmountOnClose above), so there's a real element to tween before it's gone —
  // ctx.actionsRef.current.unmount() in onComplete is what actually removes it from the tree.
  useGSAP(() => {
    if (ctx?.open === false && popupRef.current) {
      gsap.to(popupRef.current, {
        opacity: 0,
        scale: 0.96,
        y: 8,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => ctx.actionsRef.current?.unmount(),
      })
    }
  }, [ctx?.open])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={popupRef}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-panel p-4 text-sm text-popover-foreground ring-1 ring-[var(--modal-border)] outline-none sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
