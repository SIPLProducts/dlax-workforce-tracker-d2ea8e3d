import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Reads `?highlight=<id>` from the current URL. When the matching row
 * (rendered with `data-row-id={id}`) is in the DOM, scrolls it into view
 * and applies a brief ring highlight, then clears the param.
 *
 * Pass the list whose items contain the highlighted row so the effect
 * re-runs once data has loaded.
 */
export function useHighlightRow(items: Array<{ id: string }>) {
  const search = useSearch({ strict: false }) as { highlight?: string };
  const navigate = useNavigate();
  const highlightId = search?.highlight;

  useEffect(() => {
    if (!highlightId) return;
    if (!items?.some((x) => x.id === highlightId)) return;

    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-row-id="${highlightId}"]`
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const cls = ["bg-primary/10", "outline", "outline-2", "outline-primary"];
      el.classList.add(...cls);
      setTimeout(() => {
        el.classList.remove(...cls);
        navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => {
            const next = { ...prev };
            delete next.highlight;
            return next;
          },
          replace: true,
        });
      }, 2500);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, items]);
}
