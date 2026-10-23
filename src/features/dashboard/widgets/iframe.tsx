import { HiOutlineGlobeAlt } from "react-icons/hi2";
import { IframeWidget, IframeConfigFields, type IframeWidgetConfig } from "@/features/dashboard/components/IframeWidget";
import { defineWidget } from "./types";

export const iframeWidget = defineWidget<IframeWidgetConfig>({
  type: "iframe",
  label: "Embedded page",
  icon: HiOutlineGlobeAlt,
  defaultSize: "small",
  makeDefaultConfig: () => ({ preset: "windy", url: "" }),
  Render: ({ instance, cardClass }) => <IframeWidget config={instance.config as IframeWidgetConfig} cardClass={cardClass} />,
  ConfigFields: IframeConfigFields,
});
