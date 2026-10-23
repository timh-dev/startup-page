import { HiOutlineClock } from "react-icons/hi2";
import Clock from "@/features/dashboard/components/Clock";
import { defineWidget } from "./types";

export const clockWidget = defineWidget({
  type: "clock",
  label: "Clock",
  icon: HiOutlineClock,
  defaultSize: "small",
  makeDefaultConfig: () => ({}),
  Render: ({ cardClass }) => <div className={cardClass}><Clock /></div>,
});
