import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex gap-6", className)} {...props} />;
}

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex h-auto flex-col gap-2 rounded-xl bg-sidebar p-2 text-sidebar-foreground", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-start gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
