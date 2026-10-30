import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DOMAIN_KEY_GROUPS,
  createDomainExportFilename,
  createSettingsExportFilename,
  exportDomainBlob,
  exportSettingsBlob,
  listBackups,
  mergeImportedDomains,
  previewImportFile,
  resetSettings,
  restoreBackup,
  type BackupSummary,
} from "@/lib/settings";

type ApplySettingsOptions = {
  clearCustomThemeVars?: boolean;
  /** The action already saved these settings (reset, restore) rather than leaving them for "Save". */
  persisted?: boolean;
};

interface DataTabProps {
  settings: Record<string, any>;
  applySettings: (nextSettings: Record<string, any>, message: string, options?: ApplySettingsOptions) => Promise<void>;
  storageState: {
    indexedDbAvailable: boolean;
    localStorageAvailable: boolean;
    backupCount: number;
    lastSavedAt: string | null;
  } | null;
}

interface ImportPreview {
  fileName: string;
  settings: Record<string, any>;
  presentDomains: string[];
  metadata: { exportedAt: string | null };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function DataTab({ settings, applySettings, storageState }: DataTabProps) {
  const [statusMessage, setStatusMessage] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refreshBackups = React.useCallback(async () => {
    setBackups(await listBackups());
  }, []);

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const handleExportEverything = () => {
    downloadBlob(exportSettingsBlob(settings), createSettingsExportFilename());
    setStatusMessage("Exported everything.");
  };

  const handleExportDomain = (domainId: string) => {
    downloadBlob(exportDomainBlob(settings, domainId), createDomainExportFilename(domainId));
    setStatusMessage(`Exported ${DOMAIN_KEY_GROUPS[domainId].label.toLowerCase()}.`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const preview = await previewImportFile(file);
      setImportPreview({ fileName: file.name, ...preview });
      setSelectedDomains(new Set(preview.presentDomains));
      setStatusMessage("");
    } catch (error) {
      setImportPreview(null);
      setStatusMessage(error instanceof Error ? error.message : "Backup file could not be read.");
    }
  };

  const toggleImportDomain = (domainId: string, checked: boolean) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (checked) next.add(domainId);
      else next.delete(domainId);
      return next;
    });
  };

  const handleCancelImport = () => {
    setImportPreview(null);
    setSelectedDomains(new Set());
  };

  const handleApplyImport = async () => {
    if (!importPreview) return;
    const merged = mergeImportedDomains(settings, importPreview.settings, [...selectedDomains]);
    const domainLabels = [...selectedDomains].map((id) => DOMAIN_KEY_GROUPS[id]?.label.toLowerCase() || id);
    await applySettings(
      merged,
      domainLabels.length
        ? `Imported ${domainLabels.join(", ")} from ${importPreview.fileName}.`
        : `Nothing selected to import from ${importPreview.fileName}.`
    );
    setImportPreview(null);
    setSelectedDomains(new Set());
  };

  const handleReset = async () => {
    const resetResult = await resetSettings();
    await applySettings(resetResult.settings, "Settings reset and backup history refreshed.", {
      clearCustomThemeVars: true,
      persisted: true,
    });
    await refreshBackups();
  };

  const handleRestoreBackup = async (backup: BackupSummary) => {
    const result = await restoreBackup(backup.id);
    await applySettings(result.settings, `Restored the backup from ${new Date(backup.createdAt).toLocaleString()}.`, {
      persisted: true,
    });
    await refreshBackups();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>Download everything, or just one part of your data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" onClick={handleExportEverything}>
            Export everything
          </Button>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DOMAIN_KEY_GROUPS).map(([domainId, group]) => (
              <Button
                key={domainId}
                type="button"
                variant="outline"
                onClick={() => handleExportDomain(domainId)}
              >
                Export {group.label.toLowerCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import</CardTitle>
          <CardDescription>
            Pick a backup file, then choose which parts of it to apply — nothing changes until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!importPreview ? (
            <Button type="button" variant="outline" onClick={handleImportClick}>
              Choose file…
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">
                {importPreview.fileName}
                {importPreview.metadata.exportedAt
                  ? ` — exported ${new Date(importPreview.metadata.exportedAt).toLocaleString()}`
                  : ""}
              </p>
              {importPreview.presentDomains.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This file doesn't contain any recognized data.
                </p>
              ) : (
                <div className="space-y-2">
                  {importPreview.presentDomains.map((domainId) => (
                    <div key={domainId} className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-foreground">{DOMAIN_KEY_GROUPS[domainId].label}</Label>
                      <Switch
                        checked={selectedDomains.has(domainId)}
                        onCheckedChange={(checked) => toggleImportDomain(domainId, checked)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={handleApplyImport} disabled={selectedDomains.size === 0}>
                  Apply
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleCancelImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local backup history</CardTitle>
          <CardDescription>
            The last {backups.length ? Math.max(backups.length, 10) : 10} saves are kept automatically on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {backups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No local backups yet.</p>
          ) : (
            backups.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <div className="text-xs text-foreground">
                  <div>{new Date(backup.createdAt).toLocaleString()}</div>
                  <div className="text-muted-foreground">{formatBytes(backup.size)}</div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => handleRestoreBackup(backup)}>
                  Restore
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset</CardTitle>
          <CardDescription>Wipes local settings and backup history back to defaults. Your cloud copy is untouched until the next sync.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset to defaults
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        {statusMessage ? <p className="text-foreground">{statusMessage}</p> : null}
        <p>
          Storage: {storageState?.indexedDbAvailable ? "IndexedDB" : "Local mirror only"} · backups: {storageState?.backupCount ?? 0}
          {storageState?.lastSavedAt ? ` · last saved ${new Date(storageState.lastSavedAt).toLocaleString()}` : ""}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}

export default DataTab;
