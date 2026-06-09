import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Reads `?highlight=<id>` from the current URL. When the matching row
 * (rendered with `data-row-id={id}`) is in the DOM, scrolls it into view
 * and applies a persistent ring highlight.
 *
 * The highlight stays visible until the user clicks anywhere, presses a key,
 * or navigates away — at which point it is removed and `?highlight=` is
 * cleared from the URL.
 */
export function useHighlightRow(items: Array<{ id: string }>) {
  const search = useSearch({ strict: false }) as { highlight?: string };
  const navigate = useNavigate();
  const highlightId = search?.highlight;

  useEffect(() => {
    if (!highlightId) return;
    if (!items?.some((x) => x.id === highlightId)) return;

    const cls = [
      "bg-primary/10",
      "outline",
      "outline-2",
      "outline-primary",
      "rounded-sm",
    ];
    let el: HTMLElement | null = null;
    let dismissed = false;

    const raf = requestAnimationFrame(() => {
      el = document.querySelector(
        `[data-row-id="${highlightId}"]`
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(...cls);
    });

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      if (el) el.classList.remove(...cls);
      window.removeEventListener("click", dismiss, true);
      window.removeEventListener("keydown", dismiss, true);
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => {
          const next = { ...prev };
          delete next.highlight;
          return next;
        },
        replace: true,
      });
    };

    // Defer attaching dismiss listeners so the click that triggered navigation
    // (or the search dialog's own keypress) doesn't immediately clear it.
    const attachTimer = setTimeout(() => {
      window.addEventListener("click", dismiss, true);
      window.addEventListener("keydown", dismiss, true);
    }, 400);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(attachTimer);
      window.removeEventListener("click", dismiss, true);
      window.removeEventListener("keydown", dismiss, true);
      if (el && !dismissed) el.classList.remove(...cls);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, items]);
}
