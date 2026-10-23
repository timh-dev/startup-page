import { useRef, useEffect } from 'react';
import { readSettings } from '@/lib/settings';
import { getOrRequestLocation } from '@/lib/geolocation';
import { useSettingsStore } from '@/features/settings/stores';
import { calculateSolarContext, getCurrentLst, sunElevation, dayFractionToHour, type SolarContext } from './solarMath';
import { renderSky } from './renderSky';
import { createStarField, renderStars, type Star } from './renderStars';
import { getHorizonY, renderCurve } from './renderCurve';
import { renderSun } from './renderSun';
import { renderHorizonGlow } from './renderHorizonGlow';
import { renderMarkers } from './renderMarkers';
import { createAdaptiveResolution } from '@/lib/adaptive-resolution';

const SWEEP_SPEED = 0.075;
const SWEEP_INTERVAL = 22; // ms per sweep step
const TARGET_FRAME_MS = 1000 / 30; // idle at 30 fps; hover upgrades to 60

interface SolarGraphState {
  lst: number;
  sweeping: boolean;
  stars: Star[] | null;
  solar: SolarContext | null;
  animationTime: number;
  animFrameId: number | null;
  lastTimestamp: number;
  hovering: boolean;
  hoverHour: number | null;
  pixelRatio: number;
  renderWidth: number;
  renderHeight: number;
  _realTimeTimer: ReturnType<typeof setInterval> | null;
  _frameFunc: FrameRequestCallback | null;
}

export default function SolarGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SolarGraphState>({
    lst: 0,
    sweeping: true,
    stars: null,
    solar: null,
    animationTime: 0,
    animFrameId: null,
    lastTimestamp: 0,
    hovering: false,
    hoverHour: null,
    pixelRatio: 1,
    renderWidth: 0,
    renderHeight: 0,
    _realTimeTimer: null,
    _frameFunc: null,
  });

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const context = canvasEl?.getContext('2d');
    if (!canvasEl || !context) return;
    // Re-bound as non-null consts so the nested functions keep the narrowing.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;
    const state = stateRef.current;

    // Resolve location
    const settings = readSettings();

    function initSolar(lat: number, lng: number) {
      // Cancel any in-flight animation from a previous initSolar call
      if (state.animFrameId) { cancelAnimationFrame(state.animFrameId); state.animFrameId = null; }
      if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
      if (state._realTimeTimer) { clearInterval(state._realTimeTimer); state._realTimeTimer = null; }
      state.solar = calculateSolarContext(lat, lng);
      state.stars = createStarField();
      state.lst = 0;
      state.sweeping = true;
      state.lastTimestamp = performance.now();
      startAnimation();
    }

    // Supersampled: rendered at up to twice the screen's density and scaled
    // down, for smoother curves and gradients; steps down if frames run slow.
    const resolution = createAdaptiveResolution({ supersample: 2, max: 4 });

    // Resize handler
    function resize() {
      const container = canvas.parentElement;
      if (!container) return;
      const dpr = resolution.scale;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const nextWidth = Math.max(1, Math.round(w * dpr));
      const nextHeight = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      state.pixelRatio = dpr;
      state.renderWidth = w;
      state.renderHeight = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    resize();

    // Sweep timer for startup animation
    let sweepTimer: ReturnType<typeof setInterval> | null = null;

    function startAnimation() {
      const targetLst = state.solar?.currentTime ?? getCurrentLst();

      // Startup sweep: animate from 0 to current time
      sweepTimer = setInterval(() => {
        if (state.sweeping) {
          state.lst += SWEEP_SPEED;
          if (state.lst >= targetLst) {
            state.lst = targetLst;
            state.sweeping = false;
            if (sweepTimer) clearInterval(sweepTimer);
          }
        }
      }, SWEEP_INTERVAL);

      // Real-time update every 60s after sweep completes
      const realTimeTimer = setInterval(() => {
        if (!state.sweeping) {
          state.lst = getCurrentLst();
        }
      }, 60000);

      // Main render loop — 30 fps idle, 60 fps while hovering
      function frame(timestamp: number) {
        state.animFrameId = requestAnimationFrame(frame);
        if (resolution.sample(timestamp)) resize();
        const elapsed = timestamp - state.lastTimestamp;
        const targetMs = state.hovering ? 1000 / 60 : TARGET_FRAME_MS;
        if (elapsed < targetMs) return;
        if (!canvas.clientWidth) return; // ancestor has display:none — skip draw
        const dt = elapsed / 1000;
        state.lastTimestamp = timestamp;
        state.animationTime += dt;
        draw(ctx, canvas, state);
      }

      state.animFrameId = requestAnimationFrame(frame);
      state._frameFunc = frame;

      // Store for cleanup
      state._realTimeTimer = realTimeTimer;
    }

    if (state.solar) {
      // StrictMode re-mount: stateRef survived cleanup — resume the animation
      // from where it left off instead of restarting the sweep from zero.
      state.lastTimestamp = performance.now();
      startAnimation();
    } else {
      initSolar(
        settings.latitude  ?? 40.7128,
        settings.longitude ?? -74.006
      );

      // Refine with real geolocation if no saved coordinates.
      if (!settings.latitude) {
        void getOrRequestLocation().then((coords) => {
          if (coords) state.solar = calculateSolarContext(coords.lat, coords.lon);
        });
      }
    }

    function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SolarGraphState) {
      if (!state.solar || !state.stars) return;

      const w = state.renderWidth || canvas.clientWidth;
      const h = state.renderHeight || canvas.clientHeight;
      const solar = state.solar;

      // Use hovered time when hovering, otherwise real time
      const effectiveLst = state.hovering && state.hoverHour !== null ? state.hoverHour : state.lst;

      // Compute once — shared by stars, horizon glow, and sun renderers
      const cachedElev = sunElevation(solar.lat, solar.lng, effectiveLst, solar.doy);

      ctx.clearRect(0, 0, w, h);

      // 1. Sky background
      renderSky(ctx, w, h);

      // 2. Stars
      renderStars(ctx, w, h, state.stars, state.animationTime, effectiveLst, solar, cachedElev);

      // 3. Atmosphere along the horizon (behind the curve)
      const horizonY = getHorizonY(h, solar);
      renderHorizonGlow(ctx, w, h, effectiveLst, solar, horizonY, cachedElev);

      // 4. Solar curve + horizon line
      renderCurve(ctx, w, h, solar);

      // 5. Sun
      renderSun(ctx, w, h, effectiveLst, solar, horizonY, cachedElev);

      // 6. Markers (only when hovering)
      if (state.hovering) {
        renderMarkers(ctx, w, h, effectiveLst, solar, horizonY, state.lst);
      }
    }

    // Mouse event handlers for hover interaction
    function onMouseMove(e: MouseEvent) {
      if (!state.solar) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // X is the warped day position, not linear clock time — invert the warp
      // so the cursor tracks the fixed curve.
      const hour = dayFractionToHour(mouseX / rect.width, state.solar);
      state.hovering = true;
      state.hoverHour = hour;
    }

    function onMouseLeave() {
      state.hovering = false;
      state.hoverHour = null;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    // React to coordinate changes from the settings panel without a reload.
    let lastLat = settings.latitude;
    let lastLng = settings.longitude;
    const unsubscribeSettings = useSettingsStore.subscribe((storeState) => {
      const { latitude, longitude } = storeState.settings;
      if (latitude !== lastLat || longitude !== lastLng) {
        lastLat = latitude;
        lastLng = longitude;
        initSolar(latitude ?? 40.7128, longitude ?? -74.006);
      }
    });

    // Pause the render loop when the tab is hidden to avoid burning CPU in background
    function onVisibilityChange() {
      if (document.hidden) {
        if (state.animFrameId) {
          cancelAnimationFrame(state.animFrameId);
          state.animFrameId = null;
        }
      } else if (!state.animFrameId && state._frameFunc) {
        state.lastTimestamp = performance.now();
        state.animFrameId = requestAnimationFrame(state._frameFunc);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
      if (sweepTimer) clearInterval(sweepTimer);
      if (state._realTimeTimer) clearInterval(state._realTimeTimer);
      resizeObserver.disconnect();
      unsubscribeSettings();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div id="container" className="w-full h-full rounded-[inherit] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-[inherit]"
        id="canvas"
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}
