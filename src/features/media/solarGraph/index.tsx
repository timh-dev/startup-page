import { useRef, useEffect } from 'react';
import { readSettings } from '@/lib/settings';
import { calculateSolarContext, getCurrentLst, sunElevation } from './solarMath';
import { renderSky } from './renderSky';
import { createStarField, renderStars } from './renderStars';
import { renderCurve } from './renderCurve';
import { renderSun } from './renderSun';
import { renderHorizonGlow } from './renderHorizonGlow';
import { renderMarkers } from './renderMarkers';

const SWEEP_SPEED = 0.075;
const SWEEP_INTERVAL = 22; // ms per sweep step
const TARGET_FRAME_MS = 1000 / 30; // idle at 30 fps; hover upgrades to 60

export default function SolarGraph() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
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
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const state = stateRef.current;

    // Resolve location
    const settings = readSettings();

    function initSolar(lat, lng) {
      // lat/lng in degrees — no conversion needed
      state.solar = calculateSolarContext(lat, lng);
      state.stars = createStarField();
      state.lst = 0;
      state.sweeping = true;
      state.lastTimestamp = performance.now();
      startAnimation();
    }

    // Resize handler
    function resize() {
      const container = canvas.parentElement;
      const dpr = Math.min(4, Math.max(3, window.devicePixelRatio || 1));
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
    resizeObserver.observe(canvas.parentElement);
    resize();

    // Sweep timer for startup animation
    let sweepTimer = null;

    function startAnimation() {
      const targetLst = state.solar.currentTime;

      // Startup sweep: animate from 0 to current time
      sweepTimer = setInterval(() => {
        if (state.sweeping) {
          state.lst += SWEEP_SPEED;
          if (state.lst >= targetLst) {
            state.lst = targetLst;
            state.sweeping = false;
            clearInterval(sweepTimer);
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
      function frame(timestamp) {
        state.animFrameId = requestAnimationFrame(frame);
        const elapsed = timestamp - state.lastTimestamp;
        const targetMs = state.hovering ? 1000 / 60 : TARGET_FRAME_MS;
        if (elapsed < targetMs) return;
        const dt = elapsed / 1000;
        state.lastTimestamp = timestamp;
        state.animationTime += dt;
        draw(ctx, canvas, state);
      }

      state.animFrameId = requestAnimationFrame(frame);

      // Store for cleanup
      state._realTimeTimer = realTimeTimer;
    }

    if (settings.latitude) {
      initSolar(settings.latitude, settings.longitude);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => initSolar(position.coords.latitude, position.coords.longitude),
        () => initSolar(40.7128, -74.006) // fallback: NYC
      );
    } else {
      initSolar(40.7128, -74.006);
    }

    function draw(ctx, canvas, state) {
      if (!state.solar || !state.stars) return;

      const w = state.renderWidth || canvas.clientWidth;
      const h = state.renderHeight || canvas.clientHeight;
      const solar = state.solar;

      // Use hovered time when hovering, otherwise real time
      const effectiveLst = state.hovering ? state.hoverHour : state.lst;

      // Compute once — shared by stars, horizon glow, and sun renderers
      const cachedElev = sunElevation(solar.lat, solar.lng, effectiveLst, solar.doy);

      ctx.clearRect(0, 0, w, h);

      // 1. Sky background
      renderSky(ctx, w, h);

      // 2. Stars
      renderStars(ctx, w, h, state.stars, state.animationTime, effectiveLst, solar, cachedElev);

      // 3. Solar curve + horizon line
      const { horizonY } = renderCurve(ctx, w, h, solar);

      // 4. Horizon glow (sunrise/sunset effects)
      renderHorizonGlow(ctx, w, h, effectiveLst, solar, horizonY, cachedElev);

      // 5. Sun
      renderSun(ctx, w, h, effectiveLst, solar, horizonY, cachedElev);

      // 6. Markers (only when hovering)
      if (state.hovering) {
        renderMarkers(ctx, w, h, state.hoverHour, solar, horizonY, state.lst);
      }
    }

    // Mouse event handlers for hover interaction
    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const hour = Math.max(0, Math.min(24, (mouseX / rect.width) * 24));
      state.hovering = true;
      state.hoverHour = hour;
    }

    function onMouseLeave() {
      state.hovering = false;
      state.hoverHour = null;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
      if (sweepTimer) clearInterval(sweepTimer);
      if (state._realTimeTimer) clearInterval(state._realTimeTimer);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
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
