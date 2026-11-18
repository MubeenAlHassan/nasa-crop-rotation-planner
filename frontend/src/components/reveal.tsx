"use client";

import {
  useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactElement, type ReactNode,
} from "react";

export type RevealVariant = "up" | "down" | "left" | "right" | "fade" | "scale";

export interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: ReactNode;
  className?: string;
  /** Stagger delay in milliseconds. */
  delayMs?: number;
  variant?: RevealVariant;
  /** Animate as soon as mounted (page-load), instead of waiting for scroll. */
  immediate?: boolean;
  /** Animate only the first time the element enters the viewport. */
  once?: boolean;
  as?: ElementType;
  style?: CSSProperties;
}

function observerSupported(): boolean {
  return typeof window !== "undefined" && typeof window.IntersectionObserver === "function";
}

export function Reveal({
  children,
  className = "",
  delayMs = 0,
  variant = "up",
  immediate = false,
  once = true,
  as: Tag = "div",
  style,
  ...rest
}: RevealProps): ReactElement {
  const ref = useRef<HTMLElement | null>(null);
  // Immediate reveals must paint visible without waiting on effects (hydration / Strict Mode).
  const [visible, setVisible] = useState(immediate);

  useEffect(() => {
    if (immediate) {
      setVisible(true);
      return undefined;
    }
    if (!observerSupported()) {
      const timer = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(timer);
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate, once]);

  const classes = [
    "reveal",
    `reveal-${variant}`,
    visible ? "is-visible" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      style={{
        ...style,
        ["--reveal-delay" as string]: `${delayMs}ms`,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
