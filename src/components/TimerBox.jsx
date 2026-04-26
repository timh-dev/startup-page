import React from "react";
import { HiPause, HiPlay, HiStop } from "react-icons/hi2";

import { readSettings, writeSettings } from "./readSettings";

const PRESET_MINUTES = [5, 15, 25, 50];

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function TimerBox() {
  const settings = React.useMemo(() => readSettings(), []);
  const defaultMinutes = Math.max(Number(settings.timer?.focusMinutes || 25), 1);
  const [selectedMinutes, setSelectedMinutes] = React.useState(defaultMinutes);
  const [remainingSeconds, setRemainingSeconds] = React.useState(defaultMinutes * 60);
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    if (!running) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [running]);

  const progress = Math.max(0, Math.min(100, (remainingSeconds / (selectedMinutes * 60)) * 100));

  const applyPreset = (minutes) => {
    setSelectedMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setRunning(false);
    void writeSettings({
      ...readSettings(),
      timer: {
        focusMinutes: minutes,
      },
    });
  };

  const reset = () => {
    setRemainingSeconds(selectedMinutes * 60);
    setRunning(false);
  };

  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--color-primary)_22%,transparent),transparent_42%),linear-gradient(165deg,color-mix(in_oklab,var(--color-card)_94%,black_6%),color-mix(in_oklab,var(--color-accent)_26%,var(--color-card)))] p-2.5 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Timer
          </p>
          <p className="mt-0.5 text-[1.7rem] font-semibold tracking-tight text-foreground">
            {formatTime(remainingSeconds)}
          </p>
        </div>
        <div className="text-right text-[11px] leading-tight text-muted-foreground">
          <div>{selectedMinutes} min</div>
          <div>{running ? "Running" : remainingSeconds === 0 ? "Done" : "Ready"}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PRESET_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => applyPreset(minutes)}
              className={`rounded-lg px-1.5 py-1 text-[11px] font-medium transition ${
                selectedMinutes === minutes
                  ? "bg-primary text-primary-foreground"
                  : "bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {minutes}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRunning((current) => !current)}
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {running ? <HiPause className="size-4" /> : <HiPlay className="size-4" />}
            {running ? "Pause" : remainingSeconds === 0 ? "Restart" : "Start"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center justify-center rounded-xl bg-card/70 px-2.5 py-2 text-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Reset timer"
          >
            <HiStop className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
