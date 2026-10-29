import React, { useEffect, useMemo, useRef } from "react";
import { getFlashEvent, getFlashEnvelope, makeRng } from "@/features/weather/lightning";
import type { PrecipitationStyle, WeatherVisualProfile } from "@/features/weather/types/weather";
import { prefersReducedMotion } from "@/lib/power";
import { motionTime, useMotionStore } from "@/lib/motion";

const MAX_DPR = 2;

function useAnimatedCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number) => void,
  deps: React.DependencyList
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const context = canvasEl?.getContext("2d");
    if (!canvasEl || !context) return undefined;
    // Re-bound as non-null consts so the nested functions keep the narrowing.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    let animationFrame = 0;
    let lastNow = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    function frame(now: number) {
      animationFrame = requestAnimationFrame(frame);
      if (!canvas.clientWidth) return; // hidden — skip work
      // Falling rain and snow are motion for its own sake; leave them out.
      if (prefersReducedMotion()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        lastNow = now;
        return;
      }
      const speed = useMotionStore.getState().speed;
      const dt = Math.min((now - lastNow) / 1000, 0.05) * speed;
      lastNow = now;
      if (speed === 0) return; // paused: leave the last frame
      drawRef.current(ctx, canvas.width, canvas.height, dt, motionTime());
    }

    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return canvasRef;
}

// ---------------------------------------------------------------------------
// Precipitation — canvas particles with three depth tiers, gusting wind,
// per-style motion (drizzle drifts, heavy rain hammers, snow tumbles),
// and ground splashes for moderate+ rain.
// ---------------------------------------------------------------------------

interface RainDrop {
  x: number;
  y: number;
  tier: number; // 0 far, 1 mid, 2 near
  speed: number; // fraction of canvas height per second
  len: number; // fraction of canvas height
  jitter: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}

interface SnowFlake {
  x: number;
  y: number;
  tier: number;
  speed: number;
  phase: number;
  swayFreq: number;
  swayAmp: number; // fraction of width
  rot: number;
  rotSpeed: number;
  dendrite: boolean;
}

const RAIN_STYLES: ReadonlySet<string> = new Set(["drizzle", "rain", "heavy-rain", "shower-rain", "freezing-rain"]);

function makeSnowSprite(radius: number, soft: number): HTMLCanvasElement {
  const size = Math.ceil(radius * 2 + soft * 2) + 2;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius + soft);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.55, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

function makeDendriteSprite(): HTMLCanvasElement {
  const size = 26;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext("2d")!;
  const c = size / 2;
  const r = size / 2 - 2;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  for (let arm = 0; arm < 6; arm++) {
    const a = (arm / 6) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + dx * r, c + dy * r);
    ctx.stroke();
    // Side branchlets at 60° off each arm
    for (const f of [0.45, 0.7]) {
      const bx = c + dx * r * f;
      const by = c + dy * r * f;
      const bl = r * 0.22;
      for (const s of [-1, 1]) {
        const ba = a + (s * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl);
        ctx.stroke();
      }
    }
  }
  return sprite;
}

export function PrecipitationLayer({
  style,
  intensity = 0.5,
  wind = 0.2,
}: {
  style: PrecipitationStyle;
  intensity?: number;
  wind?: number;
}): React.ReactElement {
  const isRain = RAIN_STYLES.has(style);
  const heavySnow = style === "heavy-snow";

  const state = useRef<{
    drops: RainDrop[];
    flakes: SnowFlake[];
    splashes: Splash[];
    seededFor: string;
    sprites: HTMLCanvasElement[];
    dendrite: HTMLCanvasElement | null;
  }>({ drops: [], flakes: [], splashes: [], seededFor: "", sprites: [], dendrite: null });

  const canvasRef = useAnimatedCanvas(
    (ctx, w, h, dt, t) => {
      const s = state.current;
      const key = `${style}|${intensity}|${w}x${h}`;
      if (s.seededFor !== key) {
        s.seededFor = key;
        s.splashes = [];
        const areaScale = Math.min(2.4, Math.max(0.5, w / 560));
        if (isRain) {
          const base = style === "drizzle" ? 80 + intensity * 90 : 46 + intensity * 150;
          const count = Math.round(base * areaScale);
          s.drops = Array.from({ length: count }, (_, i) => {
            const tier = i % 3;
            const depth = tier / 2;
            return {
              x: Math.random(),
              y: Math.random(),
              tier,
              speed:
                (style === "drizzle" ? 0.5 : style === "heavy-rain" ? 2.7 : 2.1) *
                (0.5 + depth * 0.5) * (0.92 + Math.random() * 0.16),
              len:
                (style === "drizzle" ? 0.010 + depth * 0.012 : 0.030 + depth * 0.075) *
                (0.85 + Math.random() * 0.3) * (1 + intensity * 0.4),
              jitter: (Math.random() - 0.5) * 0.06,
            };
          });
          s.flakes = [];
        } else {
          const count = Math.round((44 + intensity * 110) * (heavySnow ? 1.5 : 1) * areaScale);
          s.flakes = Array.from({ length: count }, (_, i) => {
            const tier = i % 3;
            const depth = tier / 2;
            return {
              x: Math.random(),
              y: Math.random(),
              tier,
              speed:
                (style === "sleet" ? 0.55 : 0.045 + depth * 0.1) *
                (heavySnow ? 1.65 : 1) * (0.8 + Math.random() * 0.4),
              phase: Math.random() * Math.PI * 2,
              swayFreq: 0.5 + Math.random() * 1.1,
              swayAmp: style === "sleet" ? 0.001 : (0.004 + depth * 0.014) * (0.6 + Math.random() * 0.8),
              rot: Math.random() * Math.PI * 2,
              rotSpeed: (Math.random() - 0.5) * 1.2,
              dendrite: style !== "sleet" && tier === 2 && Math.random() < 0.16,
            };
          });
          s.drops = [];
          if (!s.sprites.length) {
            s.sprites = [makeSnowSprite(1.3, 1.6), makeSnowSprite(2.3, 2.0), makeSnowSprite(3.6, 2.6)];
            s.dendrite = makeDendriteSprite();
          }
        }
      }

      ctx.clearRect(0, 0, w, h);

      // Gusting wind: slow swells + faster flutter so sheets of rain visibly sway
      const gust = wind * (0.62 + 0.28 * Math.sin(t * 0.45) + 0.18 * Math.sin(t * 1.7 + 1.3));

      if (isRain) {
        const freezing = style === "freezing-rain";
        const tierAlpha = [0.10 + intensity * 0.10, 0.18 + intensity * 0.16, 0.30 + intensity * 0.28];
        const tierWidth = [0.7, 1.05, style === "heavy-rain" ? 1.9 : 1.5];
        const slantBase = gust * 0.55; // horizontal speed as a fraction of fall speed

        ctx.lineCap = "round";
        for (let tier = 0; tier < 3; tier++) {
          ctx.strokeStyle = freezing
            ? `rgba(185, 215, 255, ${Math.min(0.85, tierAlpha[tier] * 1.5)})`
            : `rgba(215, 230, 252, ${tierAlpha[tier] * (style === "drizzle" ? 0.7 : 1)})`;
          ctx.lineWidth = tierWidth[tier] * (w / 560 > 1 ? 1.15 : 1);
          ctx.beginPath();
          for (const d of s.drops) {
            if (d.tier !== tier) continue;
            const slant = slantBase + d.jitter;
            d.y += d.speed * dt;
            d.x += d.speed * slant * dt * (h / w);
            if (d.y > 1.02) {
              // Splash on near-tier landings during moderate+ rain
              if (tier === 2 && intensity > 0.25 && style !== "drizzle" && Math.random() < 0.55 && s.splashes.length < 26) {
                s.splashes.push({
                  x: d.x * w,
                  y: h * (0.93 + Math.random() * 0.05),
                  age: 0,
                  life: 0.3 + Math.random() * 0.2,
                  size: 2.5 + Math.random() * 3.5,
                });
              }
              d.y = -0.05 - Math.random() * 0.1;
              d.x = Math.random() * 1.04 - 0.02;
            }
            const x2 = d.x * w;
            const y2 = d.y * h;
            const lenPx = d.len * h;
            const x1 = x2 - slant * lenPx;
            const y1 = y2 - lenPx;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
        }

        // Splash ripples: expanding flattened ellipses that fade out
        for (let i = s.splashes.length - 1; i >= 0; i--) {
          const sp = s.splashes[i];
          sp.age += dt;
          if (sp.age >= sp.life) {
            s.splashes.splice(i, 1);
            continue;
          }
          const k = sp.age / sp.life;
          ctx.strokeStyle = `rgba(225, 238, 255, ${(1 - k) * 0.4})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, sp.size * (0.3 + k * 1.4), sp.size * 0.3 * (0.3 + k), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Snow / sleet
        const drift = gust * 0.5;
        if (style === "sleet") {
          ctx.lineCap = "round";
          ctx.strokeStyle = "rgba(225, 235, 248, 0.6)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (const f of s.flakes) {
            f.y += f.speed * dt;
            f.x += f.speed * drift * dt * (h / w);
            if (f.y > 1.02) {
              f.y = -0.04;
              f.x = Math.random() * 1.04 - 0.02;
            }
            const x = f.x * w;
            const y = f.y * h;
            const len = h * 0.012;
            ctx.moveTo(x - drift * len, y - len);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          const tierAlpha = [0.4, 0.62, 0.88];
          for (const f of s.flakes) {
            const depth = f.tier / 2;
            f.y += f.speed * dt;
            // Wind pushes near flakes harder; heavy snow streams sideways
            f.x += drift * (0.25 + depth * 0.75) * (heavySnow ? 0.16 : 0.08) * dt * 60 * 0.01;
            f.rot += f.rotSpeed * dt;
            if (f.y > 1.03) {
              f.y = -0.03;
              f.x = Math.random() * 1.06 - 0.03;
            }
            if (f.x > 1.05) f.x -= 1.1;
            if (f.x < -0.05) f.x += 1.1;
            const sway = Math.sin(t * f.swayFreq + f.phase) * f.swayAmp;
            const x = (f.x + sway) * w;
            const y = f.y * h;
            ctx.globalAlpha = tierAlpha[f.tier];
            if (f.dendrite && s.dendrite) {
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(f.rot);
              ctx.globalAlpha = 0.55;
              ctx.drawImage(s.dendrite, -13, -13);
              ctx.restore();
            } else {
              const sprite = s.sprites[f.tier];
              ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    },
    [style, intensity, wind, isRain, heavySnow]
  );

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${heavySnow ? "weather-heavy-snow" : ""}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightning — procedural branched bolts + sheet flashes, scheduled by the
// shared deterministic clock so the cloud shader's glow fires in sync.
// ---------------------------------------------------------------------------

interface BoltSegment {
  pts: Array<[number, number]>;
  width: number; // relative channel width
}

function generateBolt(seed: number, w: number, h: number): BoltSegment[] {
  const rng = makeRng(seed);
  const segments: BoltSegment[] = [];
  const startX = (0.15 + rng() * 0.7) * w;
  const startY = h * (0.02 + rng() * 0.1);
  const groundY = h * (0.82 + rng() * 0.14);
  const drift = (rng() - 0.5) * w * 0.3;

  const main: Array<[number, number]> = [[startX, startY]];
  const steps = 22;
  let x = startX;
  for (let i = 1; i <= steps; i++) {
    const y = startY + ((groundY - startY) * i) / steps;
    x += (rng() - 0.5) * w * 0.055 + (drift / steps);
    main.push([x, y]);
  }
  segments.push({ pts: main, width: 1 });

  // Branches forking off the main channel, thinning as they go
  let branches = 0;
  for (let i = 4; i < steps - 4 && branches < 4; i += 2) {
    if (rng() < 0.3) {
      branches += 1;
      const [bx0, by0] = main[i];
      const dir = (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.5);
      const branchSteps = 6 + Math.floor(rng() * 5);
      const branchLen = (groundY - by0) * (0.25 + rng() * 0.3);
      const pts: Array<[number, number]> = [[bx0, by0]];
      let bx = bx0;
      for (let j = 1; j <= branchSteps; j++) {
        const by = by0 + (branchLen * j) / branchSteps;
        bx += dir * (branchLen / branchSteps) * (0.6 + rng() * 0.8) + (rng() - 0.5) * w * 0.03;
        pts.push([bx, by]);
      }
      segments.push({ pts, width: 0.45 });
    }
  }
  return segments;
}

export function LightningStorm({ intensity = 0.6 }: { intensity?: number }): React.ReactElement {
  const boltRef = useRef<{ seed: number; segments: BoltSegment[] } | null>(null);
  const wasClearRef = useRef(false);

  const canvasRef = useAnimatedCanvas(
    (ctx, w, h) => {
      const now = Date.now();
      const ev = getFlashEvent(now, intensity);
      const envelope = getFlashEnvelope(now, intensity);

      if (!ev || envelope < 0.01) {
        if (!wasClearRef.current) {
          ctx.clearRect(0, 0, w, h);
          wasClearRef.current = true;
        }
        return;
      }
      wasClearRef.current = false;
      ctx.clearRect(0, 0, w, h);

      const a = envelope;
      const cx = ev.x * w;

      // Diffuse intra-cloud glow at the flash origin (both bolt + sheet types)
      const glowR = h * (ev.type === "sheet" ? 0.6 : 0.42);
      const glow = ctx.createRadialGradient(cx, h * 0.16, 0, cx, h * 0.16, glowR);
      const sheetAlpha = a * (ev.type === "sheet" ? 0.34 : 0.22);
      glow.addColorStop(0, `rgba(225, 230, 255, ${sheetAlpha})`);
      glow.addColorStop(0.55, `rgba(180, 190, 255, ${sheetAlpha * 0.45})`);
      glow.addColorStop(1, "rgba(160, 170, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      if (ev.type === "bolt") {
        if (!boltRef.current || boltRef.current.seed !== ev.seed) {
          boltRef.current = { seed: ev.seed, segments: generateBolt(ev.seed, w, h) };
        }
        const { segments } = boltRef.current;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const seg of segments) {
          const trace = (width: number, color: string, blur: number) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width * seg.width;
            ctx.shadowColor = "rgba(170, 190, 255, 0.9)";
            ctx.shadowBlur = blur;
            ctx.beginPath();
            ctx.moveTo(seg.pts[0][0], seg.pts[0][1]);
            for (let i = 1; i < seg.pts.length; i++) ctx.lineTo(seg.pts[i][0], seg.pts[i][1]);
            ctx.stroke();
          };
          trace(6.5, `rgba(130, 150, 255, ${a * 0.28})`, 16);
          trace(2.6, `rgba(215, 225, 255, ${a * 0.65})`, 6);
          trace(1.1, `rgba(255, 255, 255, ${a})`, 0);
        }
        ctx.restore();

        // Strike-point flare where the main channel meets the ground
        const main = segments[0].pts;
        const [gx, gy] = main[main.length - 1];
        const flare = ctx.createRadialGradient(gx, gy, 0, gx, gy, 34 * a + 6);
        flare.addColorStop(0, `rgba(255, 255, 255, ${a * 0.5})`);
        flare.addColorStop(1, "rgba(255, 245, 230, 0)");
        ctx.fillStyle = flare;
        ctx.fillRect(gx - 40, gy - 40, 80, 80);
      }

      // Whole-scene flash wash (the cloud shader adds its own in-cloud glow)
      ctx.fillStyle = `rgba(235, 240, 255, ${a * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    },
    [intensity]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stars / fog / atmosphere (unchanged DOM implementations)
// ---------------------------------------------------------------------------

export function Stars(): React.ReactElement {
  const stars = useMemo(
    () =>
      Array.from({ length: 220 }, () => {
        const sizeValue = Math.random() < 0.78 ? 0.38 + Math.random() * 0.62 : 1 + Math.random() * 0.85;
        return {
          left:     `${Math.random() * 100}%`,
          top:      `${Math.random() * 86}%`,
          size:     `${sizeValue}px`,
          opacity:  0.36 + Math.random() * 0.58,
          duration: `${2 + Math.random() * 3}s`,
          delay:    `${Math.random() * 3}s`,
        };
      }),
    []
  );
  return (
    <div className="weather-stars-layer absolute inset-0 z-[8] overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            opacity: s.opacity,
            animation: `weather-star-twinkle ${s.duration} ease-in-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}

/** Layered fog/mist bands that roll and drift */
export function FogMistLayer({ intensity = 0.5, style = "fog" }: { intensity?: number; style?: "fog" | "mist" }) {
  const layers = useMemo(() => {
    const count = style === "fog" ? 6 : 4;
    return Array.from({ length: count }, (_, i) => {
      const yPos = i / (count - 1); // 0=bottom, 1=top
      return {
        // fog concentrates at bottom; mist spreads more evenly
        opacity:   style === "fog"
          ? (1 - yPos * 0.7) * intensity * (0.4 + Math.random() * 0.3)
          : (0.3 + (1 - yPos) * 0.4) * intensity * (0.3 + Math.random() * 0.2),
        height:    `${14 + Math.random() * 18}%`,
        bottom:    `${yPos * 68}%`,
        blurR:     `${style === "fog" ? 18 + i * 4 : 12 + i * 3}px`,
        dur:       `${22 + i * 8 + Math.random() * 10}s`,
        delay:     `${Math.random() * -16}s`,
        dir:       i % 2 === 0 ? 1 : -1,
      };
    });
  }, [intensity, style]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {layers.map((l, i) => (
        <div
          key={i}
          className="absolute inset-x-[-10%]"
          style={{
            bottom: l.bottom,
            height: l.height,
            opacity: l.opacity,
            background: style === "fog"
              ? "linear-gradient(180deg, transparent 0%, rgba(220,228,238,0.9) 40%, rgba(220,228,238,0.9) 60%, transparent 100%)"
              : "linear-gradient(180deg, transparent 0%, rgba(235,240,245,0.7) 40%, rgba(235,240,245,0.7) 60%, transparent 100%)",
            filter: `blur(${l.blurR})`,
            animation: `weather-fog-roll-${l.dir > 0 ? "fwd" : "rev"} ${l.dur} ease-in-out infinite alternate`,
            animationDelay: l.delay,
          }}
        />
      ))}
    </div>
  );
}

export function AtmosphereLayer({ visual }: { visual: WeatherVisualProfile }): React.ReactElement {
  if (visual.atmosphereStyle === "none" && visual.surfaceWetness <= 0) return <></>;

  const isFogMist = visual.atmosphereStyle === "fog" || visual.atmosphereStyle === "mist";

  return (
    <>
      {isFogMist && (
        <FogMistLayer
          intensity={visual.atmosphereIntensity}
          style={visual.atmosphereStyle === "fog" ? "fog" : "mist"}
        />
      )}
      <div
        className={`weather-atmosphere-layer weather-atmosphere-${visual.atmosphereStyle} absolute inset-0 overflow-hidden pointer-events-none`}
        style={{
          "--weather-atmosphere-intensity": visual.atmosphereIntensity,
          "--weather-visibility": visual.visibility,
          "--weather-wetness": visual.surfaceWetness,
        } as React.CSSProperties}
      />
    </>
  );
}
