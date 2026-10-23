import React from "react";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { defineWidget } from "./types";

const VaultLauncher = React.lazy(() => import("@/features/resourceVault/components/VaultLauncher"));

export const vaultWidget = defineWidget({
  type: "vault",
  label: "Vault",
  icon: HiOutlineArchiveBox,
  defaultSize: "large",
  makeDefaultConfig: () => ({}),
  Render: ({ cardClass }) => (
    <div className={cardClass}>
      <React.Suspense fallback={null}>
        <VaultLauncher />
      </React.Suspense>
    </div>
  ),
});
