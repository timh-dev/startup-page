import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { HiOutlineXMark } from "react-icons/hi2";

import { cn } from "@/lib/utils";

function Dialog(props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-[min(96vw,1120px)] max-h-[92vh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-hidden rounded-2xl border border-border/70 bg-background p-0 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground">
            <HiOutlineXMark className="size-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
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
  DialogTrigger
};
