// Apply dynamic CSS variables / properties to a DOM node without an inline
// `style` prop. Mutates the live element's style via the DOM API.
import { useLayoutEffect } from "react";
import type { RefObject } from "react";

export type StyleVars = Record<string, string | number | null | undefined>;

export function useDynamicStyle<E extends HTMLElement | SVGElement>(
  ref: RefObject<E | null>,
  vars: StyleVars
): void {
  const key = Object.entries(vars)
    .map(([k, v]) => `${k}:${v == null ? "" : String(v)}`)
    .join("|");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of Object.entries(vars)) {
      if (v == null || v === "") {
        el.style.removeProperty(k);
        continue;
      }
      if (k.startsWith("--")) el.style.setProperty(k, String(v));
      else (el.style as unknown as Record<string, string>)[k] = String(v);
    }
  }, [key, ref, vars]);
}
