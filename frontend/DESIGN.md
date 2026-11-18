---
name: Modern Agritech Canvas
colors:
  surface: '#f3fceb'
  surface-dim: '#d4ddcc'
  surface-bright: '#f3fceb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#edf7e5'
  surface-container: '#e8f1e0'
  surface-container-high: '#e2ebda'
  surface-container-highest: '#dce5d5'
  on-surface: '#161e13'
  on-surface-variant: '#3f493f'
  inverse-surface: '#2a3327'
  inverse-on-surface: '#eaf4e3'
  outline: '#6f7a6e'
  outline-variant: '#becabc'
  surface-tint: '#006d30'
  primary: '#00652c'
  on-primary: '#ffffff'
  primary-container: '#15803d'
  on-primary-container: '#d3ffd5'
  inverse-primary: '#79db8d'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#9f3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#c5430f'
  on-tertiary-container: '#fff1ed'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#95f8a7'
  primary-fixed-dim: '#79db8d'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#005323'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832600'
  background: '#f3fceb'
  on-background: '#161e13'
  surface-variant: '#dce5d5'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

This design system expresses a forward-looking, vibrant, and sunlit agricultural ethos. It bridges precision agronomy, real-time satellite remote sensing, and field-level stewardship. The brand feeling balances grounded agrarian warmth with the crisp clarity of high-end analytical software.

### Aesthetic Movement
- **Clean Modern Agritech:** An airy, daylight-soaked foundation layered with crisp micro-borders, organic tinting, and purposeful data accents.
- **Atmosphere:** Sunlit, lush, and systematically organized. The interface completely rejects deep dark modes or heavy charcoal surfaces, committing strictly to an illuminated, high-visibility daylight spectrum suitable for both outdoor field tablets and executive desktop monitors.
- **Emotional Intent:** Optimistic, authoritative, fertile, and precise. Data density never feels oppressive; it feels like surveying well-irrigated, flourishing farmland under a clear sky.

## Colors

The palette derives strictly from photosynthetic greens, open skies, and nutrient-dense soil strata, cast against sunlit canvas backdrops.

### Canvas & Surface Hierarchy
- **Canvas Base:** `#f8faf5` (warm pale oat / field mist) forms the global screen underlay.
- **Surface Level 1 (Card/Container):** `#ffffff` (crisp daylight white) isolates content with maximum contrast.
- **Surface Level 2 (Nested Panels / Wells):** `#f1f5eb` (soft loam cream) marks secondary grouping zones, data tables, and filter bars.
- **Subtle Surface Accent:** `#e5edd8` used sparingly for active item backgrounds and hover states on light controls.

### Semantic Tonal Roles
- **Primary (Vegetation & Vigor):** `#15803d` (Deep Leaf Green) anchors primary actions, key active navigation, and dominant progress metrics. Secondary greens (`#16a34a` and `#22c55e`) serve as visual highlights, positive yield indicators, and healthy NDVI crop bands.
- **Secondary (Atmosphere & Sensor Data):** `#0284c7` (Clear Sky Cyan) represents telemetry, irrigation flow, satellite passes, and meteorological metrics, stepped through `#0ea5e9` and `#38bdf8`.
- **Tertiary (Soil & Harvest Warning):** `#c2410c` (Fertile Loam / Terracotta) governs moisture alerts, soil mineral states, yield deadlines, and critical warnings, flanked by amber loam tones (`#b45309`, `#d97706`).
- **Text & Neutral Contrast:** Never pure black. Primary copy uses `#141f12` (deepest peat forest) to maintain razor-sharp legibility with natural warmth. Secondary copy uses `#434d3f`, and subdued captions utilize `#717a6c`.

## Typography

The pairing blends the structured friendliness of **Plus Jakarta Sans** for headlines and high-level card titles with the neutral, industrial clarity of **Inter** for telemetry tables, form labels, and data points.

- **Headlines (Plus Jakarta Sans):** Generous apertures, geometric curves, and tight tracking (-0.02em on headlines) evoke clarity and vitality without feeling cold.
- **Body & Data (Inter):** Highly legible vertical proportions ensure coordinates, moisture percentages, acreage counts, and sensor logs remain effortlessly scannable across all lighting conditions.
- **Numeric Rhythm:** Enable tabular lining figures (`font-variant-numeric: tabular-nums`) on all data tables, acreage counters, and weather readouts to prevent horizontal jitter during real-time data streaming.

## Layout & Spacing

A strictly proportional 8pt-derived spacing rhythm establishes calm, legible boundaries throughout dense telemetry views and operational dashboards.

### Grid & Canvas Structure
- **Desktop (1200px+):** 12-column responsive fluid grid with `2rem` outer margins and `1.5rem` gutters. Maximum application container max-width: `1440px`.
- **Tablet (768px - 1199px):** 8-column layout with `1.5rem` outer margins and `1rem` gutters.
- **Mobile (Below 768px):** 4-column layout with `1rem` outer margins and `0.75rem` gutters. Complex multi-metric cards break down into single-column vertical stacks.

### Spacing Token Rules
- `space-xs` (4px): Micro-spacing between paired icons and status copy; badge inner gaps.
- `space-sm` (8px): Gaps between form inputs and labels; tight element groupings within cards.
- `space-md` (16px): Standard internal card padding; gap between consecutive metric blocks.
- `space-lg` (24px): Structural separating space between sections within a modular card; spacing around filter bars.
- `space-xl` (36px): Top and bottom block rhythm between major screen sections and analytical card grids.

## Elevation & Depth

This system avoids dark or heavy drop shadows, instead using crisp borders, subtle warmth-tinted ambient glows, and clean layer elevation to maintain a light-washed, sunlight-responsive UI.

### Surface Tiers & Hairline Definition
- **Crisp Structural Borders:** Every surface is bound by a structural hairline border: `1px solid rgba(20, 31, 18, 0.08)`. For input fields and passive interactive panels, this micro-border preserves structural definition even under direct sunlight.
- **Elevation Level 0 (Ground Canvas):** Flat `#f8faf5`.
- **Elevation Level 1 (Default Cards, Data Modules):** Surface `#ffffff`, border `1px solid rgba(20, 31, 18, 0.07)`, shadow `0px 2px 4px rgba(21, 128, 61, 0.02), 0px 8px 18px rgba(71, 90, 60, 0.05)`.
- **Elevation Level 2 (Floating Toolbar, Dropdowns, Hovered Tiles):** Surface `#ffffff`, border `1px solid rgba(21, 128, 61, 0.15)`, shadow `0px 4px 10px rgba(21, 128, 61, 0.04), 0px 14px 28px rgba(35, 55, 30, 0.08)`.
- **Elevation Level 3 (Modal Windows, Soil Analysis Overlays):** Surface `#ffffff`, border `1px solid rgba(20, 31, 18, 0.1)`, shadow `0px 12px 32px rgba(20, 31, 18, 0.12), 0px 24px 48px rgba(20, 31, 18, 0.06)`. Backdrop backdrop blur utilizes `backdrop-filter: blur(8px)` with `background: rgba(248, 250, 245, 0.82)`.

## Shapes

The design uses a balanced rounded geometry (`roundedness: 2`) that echoes growth and precision agronomy without straying into overly playful territory.

- **Base Radius (`0.5rem` / 8px):** Applied to standard inputs, telemetry chips, toggle segments, and button components.
- **Large Radius (`1rem` / 16px):** Standard for field overview cards, satellite map frames, modal containers, and multi-tier operational panels.
- **Extra Large Radius (`1.5rem` / 24px):** Used exclusively for high-level dashboard summaries, master hero panels, and prominent marketing banners.
- **Full Pill (`9999px`):** Reserved strictly for standalone status chips, alert badges, and interactive segment indicators to contrast with structured rectangular cards.

## Components

### Buttons
- **Primary:** Solid `#15803d` background, `#ffffff` text, 8px radius, subtle hover glow `0px 4px 14px rgba(21, 128, 61, 0.28)`. Hover transitions smoothly to `#16a34a`.
- **Secondary (Atmospheric/Telemetry):** Solid `#0284c7` background, `#ffffff` text, or subtle light tint background `#f0f9ff` with `#0284c7` border and text.
- **Earth Accent (Terracotta/Action Alert):** Solid `#c2410c` background, `#ffffff` text, intended for critical field overrides or threshold calibrations.
- **Tertiary / Ghost:** Transparent background, `1px solid rgba(20, 31, 18, 0.12)`, text `#141f12`. On hover, background transitions to `#f1f5eb`.

### Badges & Status Chips
- Badges use pill geometry (`rounded-full`) with light, glowing tinted backgrounds:
  - **Healthy Growth / Active:** `#dcfce7` fill, `#15803d` label, `1px solid rgba(21, 128, 61, 0.2)`.
  - **Irrigation / Telemetry Active:** `#e0f2fe` fill, `#0369a1` label, `1px solid rgba(2, 132, 199, 0.2)`.
  - **Moisture Alert / Soil Attention:** `#ffedd5` fill, `#c2410c` label, `1px solid rgba(194, 65, 12, 0.2)`.
  - **Dormant / Neutral:** `#f1f5eb` fill, `#434d3f` label, `1px solid rgba(20, 31, 18, 0.08)`.

### Cards & Analytical Panels
- Pure `#ffffff` base, padded with `1.5rem` (`space-lg`), defined with a subtle `1px solid rgba(20, 31, 18, 0.07)` border.
- Header zones feature crisp typographic grouping: a `label-md` uppercase category in `#717a6c`, followed by a `headline-sm` title in `#141f12`.
- Actionable cards exhibit micro-lift on hover: translateY(-2px) paired with tinted ambient elevation.

### Form Inputs & Selectors
- Background: `#ffffff`, Border: `1px solid rgba(20, 31, 18, 0.14)`, Text: `#141f12`, Placeholder: `#717a6c`.
- Focus State: Border snaps to `#15803d` with an outer ring of `3px rgba(22, 163, 74, 0.15)`.
- Input fields set inside secondary containers adopt a `#ffffff` fill to elevate themselves above `#f1f5eb` backgrounds.

### Selection Controls (Checkboxes & Radios)
- Unchecked: `#ffffff` fill, `1.5px solid rgba(20, 31, 18, 0.24)`.
- Checked: `#15803d` solid fill with crisp `#ffffff` checkmark or center pip. Focus rings match the primary leaf green glow.

### Data Visualizations & Telemetry Gauges
- **NDVI / Crop Canopy:** Multi-stop continuous green gradients (`#22c55e` to `#15803d`).
- **Hydration / Rain Accumulation:** Gradient spectrum from sky `#38bdf8` to deep oceanic cyan `#0284c7`.
- **Soil Temp & Nitrogen Saturation:** Earthy terracotta gradients (`#f59e0b` to `#c2410c`).
- Chart gridlines use faint warm dividers: `1px dashed rgba(20, 31, 18, 0.08)`. Tooltips adopt pure `#ffffff` cards with Level 2 elevation and crisp green accent borders.