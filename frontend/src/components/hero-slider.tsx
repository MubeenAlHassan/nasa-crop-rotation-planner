"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

export interface HeroSlide {
  src: string;
  alt: string;
}

const DEFAULT_SLIDES: readonly HeroSlide[] = [
  {
    src: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1800&q=80",
    alt: "Center-pivot irrigation spraying a lush green crop field at golden hour",
  },
  {
    src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=80",
    alt: "Rolling farmland under a wide sky with soft morning light",
  },
  {
    src: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=1800&q=80",
    alt: "Golden wheat heads ready for harvest in a sunlit field",
  },
  {
    src: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1800&q=80",
    alt: "Neat green crop rows stretching toward the horizon",
  },
  {
    src: "https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=1800&q=80",
    alt: "Healthy green crops growing in rich agricultural soil",
  },
];

const INTERVAL_MS = 3000;
const FADE_MS = 900;

export interface HeroSliderProps {
  slides?: readonly HeroSlide[];
  children?: ReactNode;
}

export function HeroSlider({ slides = DEFAULT_SLIDES, children }: HeroSliderProps): ReactElement {
  const [index, setIndex] = useState(0);
  const [baseIndex, setBaseIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const fadeTimer = useRef<number | undefined>(undefined);

  function goTo(next: number): void {
    if (next === index || slides.length === 0) return;
    if (fadeTimer.current !== undefined) window.clearTimeout(fadeTimer.current);
    setBaseIndex(index);
    setIndex(next);
    fadeTimer.current = window.setTimeout(() => {
      setBaseIndex(next);
      fadeTimer.current = undefined;
    }, FADE_MS);
  }

  useEffect(() => () => {
    if (fadeTimer.current !== undefined) window.clearTimeout(fadeTimer.current);
  }, []);

  useEffect(() => {
    if (paused || slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      goTo((index + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, slides.length, index]);

  return (
    <div
      className="hero-slider relative flex min-h-[calc(100svh-5rem)] w-full flex-col overflow-hidden bg-[#16301a]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      aria-roledescription="carousel"
      aria-label="Field photography"
    >
      {slides.map((slide, slideIndex) => {
        const isActive = slideIndex === index;
        const isBase = slideIndex === baseIndex;
        return (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            className={[
              "hero-slider-slide absolute inset-0 h-full w-full object-cover",
              isBase ? "is-base" : "",
              isActive ? "is-active" : "",
            ].filter(Boolean).join(" ")}
            aria-hidden={!isActive}
            decoding="async"
          />
        );
      })}

      <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-b from-[rgba(12,20,10,0.55)] via-[rgba(12,20,10,0.4)] to-[rgba(12,20,10,0.65)]" />

      <div className="relative z-[4] flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-20">
        <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col items-center">
          {children}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(15,23,12,0.45)] px-3 py-2 backdrop-blur-sm sm:bottom-8">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide.src}
            type="button"
            className={`hero-slider-dot ${slideIndex === index ? "is-active" : ""}`}
            aria-label={`Show field image ${slideIndex + 1} of ${slides.length}`}
            aria-current={slideIndex === index ? "true" : undefined}
            onClick={() => goTo(slideIndex)}
          />
        ))}
      </div>
    </div>
  );
}
