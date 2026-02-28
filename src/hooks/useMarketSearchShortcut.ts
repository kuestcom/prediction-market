"use client";

import { useEffect } from "react";

/**
 * Registers a global `Cmd+K` / `Ctrl+K` listener for the market search palette.
 *
 * Usage — wire this into your root layout or a client boundary component:
 *
 * ```tsx
 * // app/layout.tsx  (or a <Providers> component)
 * import { useMarketSearchShortcut } from "@/hooks/useMarketSearchShortcut";
 *
 * function Providers({ children }: { children: React.ReactNode }) {
 *   const [searchOpen, setSearchOpen] = useState(false);
 *   useMarketSearchShortcut(() => setSearchOpen((v) => !v));
 *
 *   return (
 *     <>
 *       {children}
 *       <MarketSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
 *     </>
 *   );
 * }
 * ```
 */
export function useMarketSearchShortcut(onOpen: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when user is typing inside a text field.
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isShortcut = (e.metaKey || e.ctrlKey) && e.key === "k";
      if (!isShortcut) return;

      e.preventDefault();
      onOpen();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}
