"use client"

import type { ComponentProps } from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@meet-ai/worker/app/lib/utils"
import { Button } from "@meet-ai/worker/app/components/ui/button"
import { XIcon } from "lucide-react"

function DrawerRoot({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-40 bg-black/5 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerPopup({
  className,
  children,
  showCloseButton = true,
  showBackdrop = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
  showBackdrop?: boolean
}) {
  return (
    <DrawerPortal>
      {showBackdrop && <DrawerBackdrop />}
      <DrawerPrimitive.Popup
        data-slot="drawer-popup"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[80dvh] flex-col rounded-t-xl bg-neutral-900 text-sm text-neutral-200 ring-1 ring-neutral-700/50 outline-none pb-[env(safe-area-inset-bottom)]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerPrimitive.Close
            data-slot="drawer-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerPrimitive.Close>
        )}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  )
}

function DrawerHandle({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-handle"
      className={cn("flex items-center justify-center py-2", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

export {
  DrawerRoot,
  DrawerPortal,
  DrawerBackdrop,
  DrawerPopup,
  DrawerHandle,
  DrawerTitle,
  DrawerClose,
}
