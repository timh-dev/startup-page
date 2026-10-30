import "react";

// Allow CSS custom properties (style={{ "--clock-hand-angle": "90deg" }})
// in inline styles without casting.
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
