/*eslint-disable*/
import React from "react";

import { readSettings } from '../components/readSettings';
import {
  DASHBOARD_LARGE_TILE,
  DASHBOARD_TALL_TILE,
  DASHBOARD_TALL_TILE_HEIGHT_PX,
  DASHBOARD_TILE,
  DASHBOARD_TILE_HEIGHT_PX,
  DASHBOARD_TILE_WIDTH_PX,
  DASHBOARD_WIDE_TILE,
  GRID_FEATURE,
  GRID_SINGLE,
  GRID_SOLAR,
  GRID_TALL,
  GRID_WIDE,
} from "../lib/dashboard-dimensions";

// components
import Clock from "../components/Clock";
import FeaturePanel from "../components/FeaturePanel";
import Unsplash from "../components/Unsplash";
import SearchBox from "../components/Search";
import SolarGraph from "../components/SolarGraph/index";
import WeatherBox from "../components/Weather";
import Toggle from "../components/ThemeToggle";
import ThemeProvider from "../components/ThemeContext";
import Bookmark from "../components/Bookmark";
import SettingsButton from "../components/SettingsButton";

// assets
import desert from "../assets/img/desert.mp4"

function DecorativeVideoTile({
  className,
  src,
  fallbackSrc,
  width,
  height,
  left,
  top,
}) {
  const [activeSrc, setActiveSrc] = React.useState(src || fallbackSrc);

  React.useEffect(() => {
    setActiveSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <div className={`${className} relative overflow-hidden`}>
      <video
        key={activeSrc}
        className="absolute max-w-none object-cover"
        style={{
          width,
          height,
          left,
          top,
        }}
        src={activeSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        referrerPolicy="no-referrer"
        onError={() => {
          if (activeSrc !== fallbackSrc) {
            setActiveSrc(fallbackSrc);
          }
        }}
      />
    </div>
  );
}

export default function Index() {
  const settings = readSettings();
  const hiddenBoxes = settings.layout?.hiddenBoxes || {};
  const showBox = (id) => !hiddenBoxes[id];
  const ui = settings.ui || {};
  const decorativeVideo = settings.decorativeVideo || {};
  const gapClass = ui.gridDensity === "compact" ? "gap-y-4 gap-x-4" : "gap-y-6 gap-x-6";
  const decorativeGap = ui.gridDensity === "compact" ? 16 : 24;
  const gridColumnsClass = "xl:grid-cols-[repeat(7,9rem)] md:grid-cols-[repeat(5,9rem)] sm:grid-cols-[repeat(3,9rem)] xs:grid-cols-[repeat(2,9rem)]";
  const gridRowsClass = "auto-rows-[9rem]";
  const radiusClass = ui.cardStyle === "soft" ? "rounded-[2rem]" : ui.cardStyle === "sharp" ? "rounded-md" : "rounded-xl";
  const showDecorativeMedia = ui.showDecorativeMedia !== false;
  const decorativeVideoUrl = decorativeVideo.url || desert;

  const panel = (extra = "") => `${radiusClass} ${extra}`;
  const surface = "bg-card text-card-foreground border border-border/60 shadow-lg";
  const mutedSurface = "bg-muted/50 text-foreground border border-border/60 shadow-lg";
  const strongSurface = "bg-primary text-primary-foreground border border-border/40 shadow-lg";

  const renderDecorativeVideo = (variant, className) => {
    const sceneWidth = DASHBOARD_TILE_WIDTH_PX + decorativeGap + DASHBOARD_TILE_WIDTH_PX;
    const sceneHeight = DASHBOARD_TALL_TILE_HEIGHT_PX;
    const viewports = {
      tall: { x: 0, y: 0, width: DASHBOARD_TILE_WIDTH_PX, height: DASHBOARD_TALL_TILE_HEIGHT_PX },
      small: {
        x: DASHBOARD_TILE_WIDTH_PX + decorativeGap,
        y: 0,
        width: DASHBOARD_TILE_WIDTH_PX,
        height: DASHBOARD_TILE_HEIGHT_PX,
      },
    };
    const viewport = viewports[variant];
    const zoom = Number(
      decorativeVideo.zoom ??
      decorativeVideo.tall?.zoom ??
      1.6
    );
    const offsetX = Number(
      decorativeVideo.offsetX ??
      decorativeVideo.tall?.offsetX ??
      0
    );
    const offsetY = Number(
      decorativeVideo.offsetY ??
      decorativeVideo.tall?.offsetY ??
      0
    );
    const scaledSceneWidth = sceneWidth * zoom;
    const scaledSceneHeight = sceneHeight * zoom;
    const left = offsetX - (viewport.x * zoom);
    const top = offsetY - (viewport.y * zoom);

    return (
      <DecorativeVideoTile
        className={className}
        src={decorativeVideoUrl}
        fallbackSrc={desert}
        width={`${scaledSceneWidth}px`}
        height={`${scaledSceneHeight}px`}
        left={`${left}px`}
        top={`${top}px`}
      />
    );
  };

  return (
    <ThemeProvider initialThemeMode={ui.themeMode} initialThemePalette={ui.themePalette}>
      <section className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 pt-10 pb-10 transition-colors">
        <div className={`grid w-fit ${gridColumnsClass} ${gridRowsClass} ${gapClass} grid-flow-row-dense content-center justify-center`}>

          {/* row 1 */}
          {showDecorativeMedia && showBox("videoTall") && <div className={panel(`overflow-hidden ${GRID_TALL} ${DASHBOARD_TALL_TILE} ${surface}`)}>
            {renderDecorativeVideo("tall", `sticky h-full w-full rounded-xl overflow-hidden`)}
          </div>}
          {showDecorativeMedia && showBox("videoSmall") && <div className={panel(`overflow-hidden ${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}>
            {renderDecorativeVideo("small", `sticky h-full w-full rounded-xl overflow-hidden`)}
          </div>}
          {showBox("search") && <div className={panel(`${GRID_WIDE} ${DASHBOARD_WIDE_TILE} ${strongSurface}`)}><SearchBox /></div>}
          {showBox("bookmark1") && <Bookmark title={ settings.bookmark[0].title } content={ settings.bookmark[0].content } cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash1") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox1 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("weather") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${mutedSurface}`)}><WeatherBox /></div>}
          
          {/* row 2 */}
          {showBox("unsplash2") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox2 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("bookmark2") && <Bookmark title={ settings.bookmark[1].title } content={ settings.bookmark[1].content } cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("featurePanel") && <div className={panel(`h-full w-full overflow-visible ${GRID_FEATURE} ${DASHBOARD_LARGE_TILE} ${surface}`)}><FeaturePanel /></div>}
          {showBox("unsplash3") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox3 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}

          {/* row 3 */}
          {showBox("bookmark3") && <Bookmark title={ settings.bookmark[2].title } content={ settings.bookmark[2].content } cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("solarGraph") && <div className={panel(`h-full w-full bg-black ${GRID_SOLAR} ${DASHBOARD_LARGE_TILE} border border-border/60 shadow-lg`)}><SolarGraph /></div>}

          {/* row 4 */}
          {showBox("bookmark4") && <Bookmark title={ settings.bookmark[3].title } content={ settings.bookmark[3].content } cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("bookmark5") && <Bookmark title={ settings.bookmark[4].title } content={ settings.bookmark[4].content } cardClass={panel(`h-full w-full ${GRID_SINGLE} ${DASHBOARD_TILE} overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash4") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox4 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("themeTools") && <div className={panel(`h-full w-full flex items-center justify-center ${GRID_SINGLE} ${DASHBOARD_TILE} ${strongSurface}`)}>
              <Toggle />
            <SettingsButton />
          </div>}
          {showBox("unsplash5") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox5 } cardClass={panel("relative overflow-hidden h-full w-full bg-center bg-no-repeat")} /></div>}
          {showBox("clock") && <div className={panel(`${GRID_SINGLE} ${DASHBOARD_TILE} ${mutedSurface}`)}><Clock /></div>}
        </div>
      </section>
    </ThemeProvider>
  );
}
