import React from "react";

interface PaperPageShellProps {
  backgroundImage: string;
  children: React.ReactNode;
}

// Scenic background + centered card page shell shared by any
// full-page feature that wants the Resource Vault's look (currently Vault
// and Bookmarks). Renders inside AppLayout, which already mounts the
// persistent nav/theme-toggle/settings chrome as a fixed overlay, so this
// only needs to supply the scene + paper card, not its own theme wiring.
export default function PaperPageShell({ backgroundImage, children }: PaperPageShellProps) {
  return (
    <div className="vault-preview-scene" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="vault-preview-scrim" />

      <div className="vault-preview-stage">
        <div className="vault-preview-paper">
          <div className="vault-preview-paper-scroll">{children}</div>
        </div>
      </div>
    </div>
  );
}
