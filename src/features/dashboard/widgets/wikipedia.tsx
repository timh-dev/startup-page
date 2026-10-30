import { HiOutlineBookOpen } from "react-icons/hi2";
import WikipediaToD from "@/features/dashboard/components/WikipediaToD";
import { defineWidget } from "./types";

export const wikipediaWidget = defineWidget({
  type: "wikipedia",
  label: "Wikipedia",
  icon: HiOutlineBookOpen,
  defaultSize: "small",
  makeDefaultConfig: () => ({}),
  Render: ({ cardClass }) => <div className={cardClass}><WikipediaToD /></div>,
});
