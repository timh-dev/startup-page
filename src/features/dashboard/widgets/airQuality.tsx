import { HiOutlineBeaker } from "react-icons/hi2";
import AirQuality from "@/features/weather/components/AirQuality";
import { defineWidget } from "./types";

export const airQualityWidget = defineWidget({
  type: "airQuality",
  label: "Air quality",
  icon: HiOutlineBeaker,
  defaultSize: "small",
  makeDefaultConfig: () => ({}),
  Render: ({ cardClass }) => <div className={cardClass}><AirQuality /></div>,
});
