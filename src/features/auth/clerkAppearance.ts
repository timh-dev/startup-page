// Maps Clerk's sign-in UI onto this app's own design tokens — the same CSS
// custom properties every theme in src/assets/styles/index.css defines — so
// it re-themes automatically on theme/dark-mode switches instead of carrying
// its own hardcoded palette. `elements` mirrors the Tailwind classes used by
// components/ui/dialog.tsx and components/ui/button.tsx so the modal reads
// as part of the app rather than a bolted-on widget.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorTextOnPrimaryBackground: "var(--primary-foreground)",
    colorBackground: "var(--background)",
    colorInputBackground: "var(--background)",
    colorInputText: "var(--foreground)",
    colorText: "var(--foreground)",
    colorTextSecondary: "var(--muted-foreground)",
    colorDanger: "var(--destructive)",
    colorNeutral: "var(--foreground)",
    colorShimmer: "var(--muted)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    modalBackdrop: "bg-black/50 backdrop-blur-sm",
    modalContent: "shadow-none",
    card: "rounded-2xl border border-border/70 bg-background shadow-2xl",
    headerTitle: "text-foreground text-xl font-semibold tracking-tight",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButton:
      "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-all",
    socialButtonsBlockButtonText: "text-foreground text-sm font-medium",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
    formFieldLabel: "text-foreground text-sm font-medium",
    formFieldInput:
      "rounded-md border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-ring/50",
    formButtonPrimary:
      "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 rounded-md text-sm font-medium transition-all",
    footerActionLink: "text-primary hover:text-primary/90",
    footerActionText: "text-muted-foreground text-sm",
    identityPreviewText: "text-foreground",
    identityPreviewEditButtonIcon: "text-primary",
    otpCodeFieldInput: "border-border bg-background text-foreground",
    formResendCodeLink: "text-primary hover:text-primary/90",
  },
};
