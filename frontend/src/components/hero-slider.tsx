"use client";

import { CloudSun, MapPinned, Sprout } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";

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
}

export function HeroSlider({ slides = DEFAULT_SLIDES }: HeroSliderProps): ReactElement {
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
      className="hero-slider relative h-[340px] w-full overflow-hidden rounded-none bg-[#16301a] shadow-[var(--shadow-lift)] sm:h-[500px] md:h-[580px] lg:h-[640px]"
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

      <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-[rgba(22,30,19,0.5)] via-transparent to-transparent" />

      <div className="absolute left-4 top-4 z-[4] flex items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-3 shadow-lg sm:left-8 sm:top-8 sm:p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary-fixed)] text-[var(--secondary)]">
          <CloudSun className="h-5 w-5" aria-hidden />
        </span>
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Observed climate</p>
          <p className="font-display text-sm font-semibold sm:text-base">90-day POWER anomalies</p>
        </div>
      </div>
      <div className="absolute bottom-5 left-4 z-[4] flex items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-3 shadow-lg sm:bottom-8 sm:left-8 sm:p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-fixed)] text-[var(--primary)]">
          <MapPinned className="h-5 w-5" aria-hidden />
        </span>
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Pinned demo farm</p>
          <p className="font-display text-sm font-semibold sm:text-base">Faisalabad 31.4504° N, 73.135° E</p>
        </div>
      </div>
      <div className="absolute bottom-5 right-4 z-[4] hidden items-center gap-3 rounded-xl bg-[rgba(255,255,255,0.95)] p-4 shadow-lg sm:flex sm:bottom-8 sm:right-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tertiary-fixed)] text-[var(--tertiary)]">
          <Sprout className="h-5 w-5" aria-hidden />
        </span>
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Decision output</p>
          <p className="font-display text-sm font-semibold">Ranked rotations + reasons</p>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[rgba(15,23,12,0.45)] px-3 py-2 backdrop-blur-sm sm:bottom-8">
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
