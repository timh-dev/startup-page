/*eslint-disable*/
import React from "react";

import { readSettings } from '../components/readSettings';

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

export default function Index() {
  const settings = readSettings();
  const hiddenBoxes = settings.layout?.hiddenBoxes || {};
  const showBox = (id) => !hiddenBoxes[id];
  const ui = settings.ui || {};
  const gapClass = ui.gridDensity === "compact" ? "gap-y-4 gap-x-4" : "gap-y-6 gap-x-6";
  const radiusClass = ui.cardStyle === "soft" ? "rounded-[2rem]" : ui.cardStyle === "sharp" ? "rounded-md" : "rounded-xl";
  const showDecorativeMedia = ui.showDecorativeMedia !== false;

  const panel = (extra = "") => `${radiusClass} ${extra}`;
  const surface = "bg-card text-card-foreground border border-border/60 shadow-lg";
  const mutedSurface = "bg-muted/50 text-foreground border border-border/60 shadow-lg";
  const strongSurface = "bg-primary text-primary-foreground border border-border/40 shadow-lg";

  return (
    <ThemeProvider initialThemeMode={ui.themeMode} initialThemePalette={ui.themePalette}>
      <section className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 pt-10 pb-10 transition-colors">
        <div className={`grid xl:grid-cols-7 md:grid-cols-5 sm:grid-cols-3 xs:grid-cols-2 ${gapClass} grid-flow-row-dense content-center`}>

          {/* row 1 */}
          {showDecorativeMedia && showBox("videoTall") && <div className={panel(`overflow-hidden col-span-1 row-span-2 h-80 w-36 ${surface}`)}>
            <div className={panel("sticky overflow-hidden h-80 w-36")}>
              <video className="relative object-cover min-h-full max-w-xl -left-12" src={ desert } type="video/mp4" autoPlay muted loop/>
            </div>
          </div>}
          {showBox("search") && <div className={panel(`col-span-2 h-36 w-80 ${strongSurface}`)}><SearchBox /></div>}
          {showBox("bookmark1") && <Bookmark title={ settings.bookmark[0].title } content={ settings.bookmark[0].content } cardClass={panel(`col-span-1 h-36 w-36 overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash1") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox1 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}
          {showBox("weather") && <div className={panel(`col-span-1 h-36 w-36 ${mutedSurface}`)}><WeatherBox /></div>}
          
          {/* row 2 */}
          {showBox("unsplash2") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox2 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}
          {showBox("bookmark2") && <Bookmark title={ settings.bookmark[1].title } content={ settings.bookmark[1].content } cardClass={panel(`col-span-1 h-36 w-36 overflow-y-auto ${strongSurface}`)} />}
          {showBox("featurePanel") && <div className={panel(`overflow-visible col-span-3 row-span-2 h-80 ${surface}`)}><FeaturePanel /></div>}

          {/* row 3 */}
          {showBox("bookmark3") && <Bookmark title={ settings.bookmark[2].title } content={ settings.bookmark[2].content } cardClass={panel(`col-span-1 h-36 w-36 overflow-y-auto ${strongSurface}`)} />}
          {showBox("solarGraph") && <div className={panel("bg-black col-span-2 row-span-2 border border-border/60 shadow-lg")}><SolarGraph /></div>}
          {showBox("unsplash3") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox3 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}

          {/* row 4 */}
          {showBox("bookmark4") && <Bookmark title={ settings.bookmark[3].title } content={ settings.bookmark[3].content } cardClass={panel(`col-span-1 h-36 w-36 overflow-y-auto ${strongSurface}`)} />}
          {showBox("bookmark5") && <Bookmark title={ settings.bookmark[4].title } content={ settings.bookmark[4].content } cardClass={panel(`col-span-1 h-36 w-36 overflow-y-auto ${strongSurface}`)} />}
          {showBox("unsplash4") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox4 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}
          {showBox("themeTools") && <div className={panel(`flex items-center justify-center col-span-1 h-36 w-36 ${strongSurface}`)}>
              <Toggle />
            <SettingsButton />
          </div>}
          {showBox("unsplash5") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox5 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}
          {showBox("clock") && <div className={panel(`col-span-1 h-36 w-36 ${mutedSurface}`)}><Clock /></div>}
          {showBox("unsplash6") && <div className={panel(`col-span-1 h-36 w-36 ${surface}`)}><Unsplash search={ settings.unsplash.unsplashBox6 } cardClass={panel("relative overflow-hidden h-full bg-center bg-no-repeat")} /></div>}
        </div>
      </section>
    </ThemeProvider>
  );
}
