import { useRef, useEffect } from 'react';
import { readSettings } from '../readSettings';
import { calculateSolarContext, getCurrentLst } from './solarMath';
import { renderSky } from './renderSky';
import { createStarField, renderStars } from './renderStars';
import { renderCurve } from './renderCurve';
import { renderSun } from './renderSun';
import { renderHorizonGlow } from './renderHorizonGlow';
import { renderMarkers } from './renderMarkers';

const SWEEP_SPEED = 0.1;
const SWEEP_INTERVAL = 22; // ms per sweep step

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

    // Resize handler
    function resize() {
      const container = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      // Main render loop
      function frame(timestamp) {
        const dt = (timestamp - state.lastTimestamp) / 1000;
        state.lastTimestamp = timestamp;
        state.animationTime += dt;

        draw(ctx, canvas, state);
        state.animFrameId = requestAnimationFrame(frame);
      }

      state.animFrameId = requestAnimationFrame(frame);

      // Store for cleanup
      state._realTimeTimer = realTimeTimer;
    }

    function draw(ctx, canvas, state) {
      if (!state.solar || !state.stars) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const solar = state.solar;

      // Use hovered time when hovering, otherwise real time
      const effectiveLst = state.hovering ? state.hoverHour : state.lst;

      ctx.clearRect(0, 0, w, h);

      // 1. Sky background
      renderSky(ctx, w, h, effectiveLst, solar);

      // 2. Stars
      renderStars(ctx, w, h, state.stars, state.animationTime, effectiveLst, solar);

      // 3. Solar curve + horizon line
      const { horizonY } = renderCurve(ctx, w, h, solar);

      // 4. Horizon glow (sunrise/sunset effects)
      renderHorizonGlow(ctx, w, h, effectiveLst, solar, horizonY);

      // 5. Sun
      renderSun(ctx, w, h, effectiveLst, solar, horizonY);

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
    <div id="container" className="w-full h-full rounded-xl">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
        id="canvas"
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
}
