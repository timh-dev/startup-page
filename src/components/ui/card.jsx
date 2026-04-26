import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <div data-slot="card-title" className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div data-slot="card-footer" className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
