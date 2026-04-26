import React from "react";
import {
  WiCloud,
  WiCloudy,
  WiDayCloudy,
  WiDayHaze,
  WiDaySunny,
  WiDust,
  WiFog,
  WiMoonWaxingCrescent3,
  WiNightCloudy,
  WiRain,
  WiRaindrops,
  WiSnowflakeCold,
  WiSprinkle,
  WiThunderstorm,
  WiTornado,
} from "react-icons/wi";

import { readSettings } from "./readSettings";

const WEATHER_ICONS = [
  { weather: "Clear", iconDay: <WiDaySunny />, iconNight: <WiMoonWaxingCrescent3 /> },
  {
    weather: "Clouds",
    iconFewDay: <WiDayCloudy />,
    iconFewNight: <WiNightCloudy />,
    iconScatterDay: <WiDayCloudy />,
    iconScatterNight: <WiNightCloudy />,
    iconBroken: <WiCloud />,
    iconOvercast: <WiCloudy />,
  },
  { weather: "Drizzle", icon: <WiSprinkle /> },
  { weather: "Rain", icon: <WiRain /> },
  { weather: "Thunderstorm", icon: <WiThunderstorm /> },
  { weather: "Snow", icon: <WiSnowflakeCold /> },
  { weather: "Fog", icon: <WiFog /> },
  { weather: "Mist", icon: <WiRaindrops /> },
  { weather: "Haze", icon: <WiDayHaze /> },
  { weather: "Tornado", icon: <WiTornado /> },
  { weather: "Dust", icon: <WiDust /> },
];

const OPEN_METEO_CODES = {
  0: { weather: "Clear", description: "Clear sky" },
  1: { weather: "Clouds", description: "Mainly clear" },
  2: { weather: "Clouds", description: "Partly cloudy" },
  3: { weather: "Clouds", description: "Overcast" },
  45: { weather: "Fog", description: "Fog" },
  48: { weather: "Fog", description: "Depositing rime fog" },
  51: { weather: "Drizzle", description: "Light drizzle" },
  53: { weather: "Drizzle", description: "Moderate drizzle" },
  55: { weather: "Drizzle", description: "Dense drizzle" },
  56: { weather: "Drizzle", description: "Light freezing drizzle" },
  57: { weather: "Drizzle", description: "Dense freezing drizzle" },
  61: { weather: "Rain", description: "Slight rain" },
  63: { weather: "Rain", description: "Moderate rain" },
  65: { weather: "Rain", description: "Heavy rain" },
  66: { weather: "Rain", description: "Light freezing rain" },
  67: { weather: "Rain", description: "Heavy freezing rain" },
  71: { weather: "Snow", description: "Slight snow fall" },
  73: { weather: "Snow", description: "Moderate snow fall" },
  75: { weather: "Snow", description: "Heavy snow fall" },
  77: { weather: "Snow", description: "Snow grains" },
  80: { weather: "Rain", description: "Slight rain showers" },
  81: { weather: "Rain", description: "Moderate rain showers" },
  82: { weather: "Rain", description: "Violent rain showers" },
  85: { weather: "Snow", description: "Slight snow showers" },
  86: { weather: "Snow", description: "Heavy snow showers" },
  95: { weather: "Thunderstorm", description: "Thunderstorm" },
  96: { weather: "Thunderstorm", description: "Thunderstorm with hail" },
  99: { weather: "Thunderstorm", description: "Thunderstorm with heavy hail" },
};

class WeatherBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      temperature: "--",
      location: "Weather",
      icon: <WiCloudy />,
      desc: "Waiting for weather data",
      link: "https://openweathermap.org/",
      status: "loading",
    };
  }

  isDay() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }

  resolveWeatherIcon(data) {
    const weatherIcon = WEATHER_ICONS.find(
      (entry) => entry.weather === data.weather?.[0]?.main
    );

    if (!weatherIcon) {
      return <WiCloudy />;
    }

    if (weatherIcon.weather === "Clear") {
      return this.isDay() ? weatherIcon.iconDay : weatherIcon.iconNight;
    }

    if (weatherIcon.weather === "Clouds") {
      const code = data.weather?.[0]?.id;
      if (code === 801) {
        return this.isDay() ? weatherIcon.iconFewDay : weatherIcon.iconFewNight;
      }
      if (code === 802) {
        return this.isDay()
          ? weatherIcon.iconScatterDay
          : weatherIcon.iconScatterNight;
      }
      if (code === 803) {
        return weatherIcon.iconBroken;
      }
      return weatherIcon.iconOvercast;
    }

    return weatherIcon.icon;
  }

  async fetchData(lat, lon, key, unit) {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=${unit}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Weather request failed");
    }

    this.applyWeather(data, lat, lon);
  }

  async fetchOpenMeteoData(lat, lon, unit) {
    const temperatureUnit = unit === "imperial" ? "fahrenheit" : "celsius";
    const windSpeedUnit = unit === "imperial" ? "mph" : "kmh";
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=${temperatureUnit}&wind_speed_unit=${windSpeedUnit}&timezone=auto`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.reason || "Open-Meteo request failed");
    }

    this.applyOpenMeteoWeather(data, lat, lon, unit);
  }

  applyWeather(data, lat, lon) {
    const icon = this.resolveWeatherIcon(data);
    const unitLabel = data.sys?.country === "US" ? "F" : "C";
    const temperature = `${Math.round(data.main?.temp ?? 0)}° ${unitLabel}`;
    const desc = data.weather?.[0]?.description || "Current conditions";
    const link = `https://openweathermap.org/?lat=${lat}&lon=${lon}&zoom=8`;

    this.setState({
      temperature,
      location: data.name || "Unknown location",
      icon,
      desc,
      link,
      status: "ready",
    });
  }

  applyOpenMeteoWeather(data, lat, lon, unit) {
    const code = data.current?.weather_code;
    const mappedWeather = OPEN_METEO_CODES[code] || {
      weather: "Clouds",
      description: "Current conditions",
    };

    const normalizedWeather = {
      weather: [{ main: mappedWeather.weather, id: code }],
    };
    const icon = this.resolveWeatherIcon(normalizedWeather);
    const unitLabel = unit === "imperial" ? "F" : "C";
    const temperature = `${Math.round(data.current?.temperature_2m ?? 0)}° ${unitLabel}`;
    const desc = mappedWeather.description;
    const link = `https://open-meteo.com/en/docs?latitude=${lat}&longitude=${lon}`;
    const location = this.buildFallbackLocationLabel(lat, lon);

    this.setState({
      temperature,
      location,
      icon,
      desc,
      link,
      status: "ready",
    });
  }

  buildFallbackLocationLabel(lat, lon) {
    return `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`;
  }

  loadWeather(lat, lon, key, unit) {
    if (key) {
      return this.fetchData(lat, lon, key, unit).catch(() =>
        this.fetchOpenMeteoData(lat, lon, unit)
      );
    }

    return this.fetchOpenMeteoData(lat, lon, unit);
  }

  componentDidMount() {
    const settings = readSettings();
    const unit = settings.units || "imperial";
    const key = settings.openWeatherCredential;

    if (settings.latitude && settings.longitude) {
      this.loadWeather(settings.latitude, settings.longitude, key, unit).catch(() => {
        this.setState({
          status: "error",
          location: "Weather unavailable",
          desc: "Could not load the forecast",
          temperature: "--",
        });
      });
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.loadWeather(
            position.coords.latitude,
            position.coords.longitude,
            key,
            unit
          ).catch(() => {
            this.setState({
              status: "error",
              location: "Weather unavailable",
              desc: "Could not load the forecast",
              temperature: "--",
            });
          });
        },
        () => {
          this.setState({
            status: "location-error",
            location: "Location unavailable",
            desc: "Set coordinates in settings",
            temperature: "--",
          });
        }
      );
      return;
    }

    this.setState({
      status: "location-error",
      location: "Location unavailable",
      desc: "Geolocation is not supported",
      temperature: "--",
    });
  }

  render() {
    const { temperature, location, icon, desc, link, status } = this.state;
    const interactive = status === "ready";

    return (
      <a
        className="group flex h-full w-full flex-col justify-between overflow-hidden rounded-inherit bg-[radial-gradient(circle_at_top_right,_color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent_35%),linear-gradient(160deg,color-mix(in_oklab,var(--color-card)_94%,black_6%),color-mix(in_oklab,var(--color-accent)_28%,var(--color-card)))] p-3 text-card-foreground"
        href={interactive ? link : undefined}
        target={interactive ? "_blank" : undefined}
        rel={interactive ? "noreferrer" : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Local Weather
            </div>
            <div
              title={desc}
              className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground"
            >
              {temperature}
            </div>
          </div>
          <div className="shrink-0 text-4xl leading-none text-primary transition-transform group-hover:scale-105">
            {icon}
          </div>
        </div>

        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{location}</p>
          <p className="line-clamp-2 text-xs capitalize leading-snug text-muted-foreground">
            {desc}
          </p>
        </div>
      </a>
    );
  }
}

export default WeatherBox;
