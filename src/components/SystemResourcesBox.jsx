import React from "react";
import { HiBolt, HiCircleStack, HiCpuChip, HiSignal } from "react-icons/hi2";

function formatStorage(value) {
  if (value == null) {
    return "Unavailable";
  }

  const gb = value / 1024 / 1024 / 1024;
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}

function Metric({ icon: Icon, label, value, subtle }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
      {subtle ? <div className="mt-1 text-xs text-muted-foreground">{subtle}</div> : null}
    </div>
  );
}

export default function SystemResourcesBox({ detailed = false }) {
  const [snapshot, setSnapshot] = React.useState({
    cores: navigator.hardwareConcurrency || null,
    deviceMemory: navigator.deviceMemory || null,
    downlink: navigator.connection?.downlink || null,
    networkType: navigator.connection?.effectiveType || null,
    batteryLevel: null,
    batteryCharging: null,
    storageQuota: null,
    storageUsage: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function collectSnapshot() {
      const nextSnapshot = {
        cores: navigator.hardwareConcurrency || null,
        deviceMemory: navigator.deviceMemory || null,
        downlink: navigator.connection?.downlink || null,
        networkType: navigator.connection?.effectiveType || null,
        batteryLevel: null,
        batteryCharging: null,
        storageQuota: null,
        storageUsage: null,
      };

      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        nextSnapshot.storageQuota = estimate.quota ?? null;
        nextSnapshot.storageUsage = estimate.usage ?? null;
      }

      if (navigator.getBattery) {
        try {
          const battery = await navigator.getBattery();
          nextSnapshot.batteryLevel = battery.level;
          nextSnapshot.batteryCharging = battery.charging;
        } catch (_error) {
          nextSnapshot.batteryLevel = null;
        }
      }

      if (!cancelled) {
        setSnapshot(nextSnapshot);
      }
    }

    collectSnapshot();
    const intervalId = window.setInterval(collectSnapshot, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const usagePercent =
    snapshot.storageQuota && snapshot.storageUsage
      ? Math.round((snapshot.storageUsage / snapshot.storageQuota) * 100)
      : null;

  return (
    <div className="flex h-full w-full flex-col rounded-inherit bg-[radial-gradient(circle_at_top_left,_color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent_40%),linear-gradient(155deg,color-mix(in_oklab,var(--color-card)_95%,black_5%),color-mix(in_oklab,var(--color-secondary)_25%,var(--color-card)))] p-4 text-card-foreground">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            System
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Browser Resources</h3>
        </div>
        {detailed ? <div className="text-xs text-muted-foreground">Live capability snapshot</div> : null}
      </div>

      <div className={`grid flex-1 gap-3 ${detailed ? "md:grid-cols-2" : "grid-cols-2"}`}>
        <Metric
          icon={HiCpuChip}
          label="CPU"
          value={snapshot.cores ? `${snapshot.cores} cores` : "Unavailable"}
          subtle="Browser-reported hardware concurrency"
        />
        <Metric
          icon={HiCircleStack}
          label="Memory"
          value={snapshot.deviceMemory ? `${snapshot.deviceMemory} GB` : "Unavailable"}
          subtle="Approximate device memory"
        />
        <Metric
          icon={HiSignal}
          label="Network"
          value={snapshot.networkType ? snapshot.networkType : "Unavailable"}
          subtle={snapshot.downlink ? `${snapshot.downlink} Mbps downlink` : "Connection details unavailable"}
        />
        <Metric
          icon={HiBolt}
          label="Power"
          value={
            snapshot.batteryLevel == null
              ? "Unavailable"
              : `${Math.round(snapshot.batteryLevel * 100)}%`
          }
          subtle={
            snapshot.batteryLevel == null
              ? "Battery API is not available in this browser"
              : snapshot.batteryCharging
                ? "Charging"
                : "On battery"
          }
        />
      </div>

      {detailed ? (
        <div className="mt-3 rounded-2xl border border-border/60 bg-card/35 p-3 text-sm text-muted-foreground">
          Storage: {formatStorage(snapshot.storageUsage)} used of {formatStorage(snapshot.storageQuota)}
          {usagePercent != null ? ` (${usagePercent}%)` : ""}
        </div>
      ) : null}
    </div>
  );
}
