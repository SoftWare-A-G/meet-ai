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
        "fixed inset-0 z-40 bg-black/20 opacity-0 transition-opacity duration-300 ease-out data-open:opacity-100",
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
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex h-dvh items-end"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          className={cn(
            "pointer-events-auto w-full flex max-h-[80dvh] flex-col rounded-t-xl bg-neutral-900 text-sm text-neutral-200 ring-1 ring-neutral-700/50 outline-none pb-[env(safe-area-inset-bottom)]",
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
      </DrawerPrimitive.Viewport>
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

function DrawerContent({
  className,
  ...props
}: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-content"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
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
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
  DrawerClose,
}
