import React from "react";
import { HiOutlineSquares2X2 } from "react-icons/hi2";
import { defineWidget } from "./types";

// Lazy: a stack pulls in every widget type it can hold.
const StackWidget = React.lazy(() =>
  import("@/features/dashboard/components/StackWidget").then((m) => ({ default: m.StackWidget })),
);

export const stackWidget = defineWidget({
  type: "stack",
  label: "Stack (swipeable)",
  icon: HiOutlineSquares2X2,
  defaultSize: "feature",
  makeDefaultConfig: () => ({}),
  Render: ({ instance, cardClass }) => (
    <React.Suspense fallback={<div className={cardClass} />}>
      <StackWidget items={instance.items || []} cardClass={cardClass} />
    </React.Suspense>
  ),
});
