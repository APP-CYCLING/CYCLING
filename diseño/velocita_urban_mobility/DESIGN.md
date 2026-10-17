---
name: Velocita Urban Mobility
colors:
  surface: '#f5fbf3'
  surface-dim: '#d5dcd4'
  surface-bright: '#f5fbf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff5ed'
  surface-container: '#e9f0e7'
  surface-container-high: '#e3eae2'
  surface-container-highest: '#dee4dc'
  on-surface: '#171d18'
  on-surface-variant: '#424939'
  inverse-surface: '#2b322d'
  inverse-on-surface: '#ecf3ea'
  outline: '#727a68'
  outline-variant: '#c2c9b5'
  surface-tint: '#3a6a00'
  primary: '#3a6a00'
  on-primary: '#ffffff'
  primary-container: '#a7e66a'
  on-primary-container: '#386700'
  inverse-primary: '#9ad85e'
  secondary: '#5b5f5a'
  on-secondary: '#ffffff'
  secondary-container: '#e0e4dd'
  on-secondary-container: '#616560'
  tertiary: '#845400'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffcb8b'
  on-tertiary-container: '#805100'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b5f577'
  primary-fixed-dim: '#9ad85e'
  on-primary-fixed: '#0e2000'
  on-primary-fixed-variant: '#2b5000'
  secondary-fixed: '#e0e4dd'
  secondary-fixed-dim: '#c4c8c1'
  on-secondary-fixed: '#191d18'
  on-secondary-fixed-variant: '#444843'
  tertiary-fixed: '#ffddb6'
  tertiary-fixed-dim: '#ffb95b'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#f5fbf3'
  on-background: '#171d18'
  surface-variant: '#dee4dc'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-nav:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets urban commuters, performance gravel cyclists, and city explorers navigating dense metropolitan environments. It balances high-performance sports engineering with minimalist Swiss functionalism. The interface prioritizes rapid glanceability, situational awareness under direct sunlight, and frictionless single-tap ergonomics while riding.

Visual principles:
- **Functional Hyper-Clarity:** Pure functional elements strip away unnecessary visual noise. Map canvas and critical metrics dominate the hierarchy.
- **Kinetic Precision:** High-contrast accents channel momentum and precision navigation without distracting from real-world road awareness.
- **Tactile Trust:** Crisp line geometry, frosted glass backdrops on floating HUD controls, and purposeful haptic confirmations instill confidence in high-speed, unpredictable urban conditions.
- **Localization:** Primary interface voice in Spanish (`es-ES` / `es-419`), utilizing concise phrasing designed to fit narrow mobile viewports without clipping.

## Colors

The palette is engineered for extreme legibility against satellite, vector cartography, and high-glare daytime environments.

### Core Swatches
- **Primary / Accent Lime Green (`#A7E66A`):** Key interactive focus, active turn indicators, confirmed bike paths, and primary positive state indicators. High luminous efficiency ensures visibility against dark surfaces.
- **Dark / Near-Black (`#151915`):** Foundational ground for night mode, primary high-contrast typography, polyline casings, and high-impact CTA containers.
- **Light Background (`#F6F8F3`):** Neutral canvas for daylight screens, off-route cards, and modal bottom sheets.
- **Dark Gray (`#333833`):** Secondary text, subtle map boundary lines, icon strokes on light surfaces, and inactive states.
- **Secondary Gray (`#858C85`):** Subdued metadata, distance units, deactivated toggle tracks, and structural hairline dividers.
- **Subtle Green Surface (`#EAF7DC`):** Background fill for selected filter chips, turn-by-turn notification banners, and protected lane callouts.
- **Warning Orange (`#E8A446`):** Road hazards, surface disrepair warnings, construction reroutes, and critical battery notifications.
- **White (`#FFFFFF`):** High-elevation floating controls, card surfaces, and interior core route lines.

### Cartographic Semantics
- **Dedicated Protected Bike Lane:** Solid `#A7E66A`, stroke-width 4dp.
- **Painted / Shared Bike Lane:** Dashed `#A7E66A` (stroke 3dp, dash 6dp, gap 4dp) with `#333833` 0.5dp edge stroke.
- **Selected Navigation Route:** Outer casing `#151915` (stroke 8dp), inner fill `#A7E66A` (stroke 5dp), with optional pulse glow.
- **Alternative Routes:** Solid `#858C85` (stroke 4dp) with 60% opacity.
- **User Location Puck:** Inner solid `#151915` with `#A7E66A` 3dp ring, flanked by an animated radial radar pulse fading from `#A7E66A` at 40% opacity to 0%.

## Typography

Typography relies on `Inter` across all structural layers to maximize rapid recognition at distance and while in motion. Numbers and telemetry (speed, cadence, remaining distance, gradient percentage) utilize tabular lining figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during rapid real-time updates.

### Usage Hierarchy
- **`metric-nav` & `display-lg-mobile`:** Exclusively for turn-by-turn distance counters ("250 m", "12 km/h") and elevation summaries.
- **`headline-md`:** Directional commands ("Gira a la derecha en Carrer d'Aragó", "Continúa recto").
- **`label-lg` / `label-md`:** Action CTAs ("Iniciar ruta", "Detener", "Guardar"), filter pills, and navigation badge counters.
- **`body-sm` / `label-sm`:** Micro-telemetry captions ("DURACIÓN RESTANTE", "DESNIVEL +"). Set in uppercase when applied to `label-sm` for immediate glanceability.

## Layout & Spacing

Layout adheres to an uncompromising 8-point spatial system (`0.5rem` / 8px baseline increment, half-steps permitted at `0.25rem` / 4px for tight badge padding and icon-to-label inline gaps).

### Viewport Specifications
- **Target Native Dimension:** 393 x 852 logical points (iPhone standard modern viewport / equivalent Android 1080p density bucket).
- **Safe Area Insets:** Dynamic top padding (54pt minimum for Dynamic Island/Camera notch alignment); bottom padding (34pt for iOS home bar indicator / Android gesture handle).
- **Navigation HUD Canvas:** Fluid full-bleed map background layer with floating overlay sheets. Margins to screen edge are fixed to `margin` (16px) horizontally.
- **Floating Controls:** Quick actions (re-center, zoom, layers) align to right margin (16px) with stacked 12px vertical gaps (`0.75rem`), positioned safely above the bottom sheet threshold.
- **Bottom Sheet States:**
  - *Collapsed Peek:* 96px height above bottom safe area, showing primary maneuver and ETA.
  - *Half Expanded:* 340px height, presenting route elevation graph, surface quality breakdown, and waypoints.
  - *Fully Open:* 90% viewport height, revealing full turn list and route alternatives.

## Elevation & Depth

Depth is established through a hybrid of crisp structural borders, tonal surfaces, and subtle, physical frosted-glass backdrops (`backdrop-filter: blur(16px)`).

### Elevation Hierarchy
- **Level 0 (Map Base Layer):** Native canvas flat plane (`#F6F8F3` in light mode, `#151915` in night navigation mode).
- **Level 1 (Docked Surface Containers & Bottom Sheets):** `#FFFFFF` fill with an ultra-fine border (`1px solid rgba(21, 25, 21, 0.08)`). Shadow: `0px 4px 20px -2px rgba(21, 25, 21, 0.06)`.
- **Level 2 (Floating Action Buttons & Map Controls):** Glassmorphic surface: `rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(12px)`. Border: `1px solid rgba(255, 255, 255, 0.60)`. Shadow: `0px 8px 24px -4px rgba(21, 25, 21, 0.12)`.
- **Level 3 (Turn-by-Turn Instruction Banner):** High-contrast header element. Background: `#151915` with `1px solid rgba(167, 230, 106, 0.20)`. Shadow: `0px 12px 32px -4px rgba(21, 25, 21, 0.25)`.
- **Level 4 (Emergency / Modals / Alerts):** `#FFFFFF` surface with `0px 20px 48px -8px rgba(21, 25, 21, 0.35)`.

## Shapes

The geometric signature uses rounded rectangular containers offset by full pill geometry for hyper-tactile, immediate touch targets.

- **Cards, Drawers & Bottom Sheets:** 16px to 20px (`1rem` to `1.25rem`) continuous squircle curves. Modals and bottom sheet top edges use 24px top radius.
- **Primary CTAs & Filter Chips:** Pure pill shape (`border-radius: 9999px`) to immediately signal interactive affordance.
- **Floating Map Buttons (HUD):** Circular (`border-radius: 9999px`) with uniform 48px x 48px touch bounding box.
- **Telemetry Metric Tiles:** 12px border radius, nested inside parent 16px cards.

## Components

### Buttons
- **Primary Action (CTA):** Pill-shaped (`border-radius: 9999px`), height 56px. Background: `#151915`, text: `#A7E66A`, font: `label-lg`. Tap state: `#333833`. Example: "Iniciar ruta", "Confirmar trayecto".
- **Accent High-Visibility Action:** Height 56px, background `#A7E66A`, text `#151915`. Tap state: `#95D15C`. Used for emergency stops and key reroute triggers.
- **Secondary / Ghost:** Height 48px, background `transparent`, border `1.5px solid #151915`, text `#151915`.
- **Floating Map HUD Buttons:** 48x48px circle, background `rgba(255, 255, 255, 0.92)`, border `1px solid rgba(21, 25, 21, 0.08)`, 24px Lucide outline icon tinted with `#151915`.

### Chips & Route Filter Selectors
- **Default State:** Height 36px, pill-shaped, background `#FFFFFF`, border `1px solid #858C85` at 40% opacity, text `#333833`, font `label-md`.
- **Active State:** Height 36px, pill-shaped, background `#EAF7DC`, border `1.5px solid #A7E66A`, text `#151915`, leading icon `#151915`. Example labels: "Vía ciclista protegida", "Menos desnivel", "Superficie asfaltada".

### Navigation HUD & Maneuver Cards
- **Turn Guidance Banner:** Top anchored. Background `#151915`, border-radius 20px, interior padding 16px. Left side features high-contrast maneuver arrow in `#A7E66A` (e.g., sharp right turn, roundabout exit), right side features remaining distance in `metric-nav` and street name in `headline-sm` (`#FFFFFF`).
- **Telemetry Bar:** Horizontal strip featuring 3 column segments: "Velocidad actual", "Distancia restante", "Hora estimada". Separators: 1px vertical borders in `#333833`.

### Lists & Waypoints
- **Waypoint Items:** 64px row height. Left element: ordered step index or transit icon inside a 32px `#EAF7DC` circle with `#151915` glyph. Middle: Title in `label-lg`, subtitle in `body-sm` (`#858C85`). Right: Distance delta ("+1.4 km"). Divider: hairline `#151915` at 8% opacity with 16px left inset.

### Inputs & Search Bars
- **Route Search Field:** Height 52px, border-radius 16px, background `#FFFFFF`, border `1.5px solid rgba(21, 25, 21, 0.12)`. Left icon: search loupe in `#333833`. Placeholder: "Buscar destino o carril bici..." in `#858C85`. Right clear icon: circular 20px badge in `#858C85`. Focus state: border `2px solid #151915`.

### Toggle Switches & Selection Controls
- **Switch:** Track 52px width x 32px height, 16px radius. Inactive track: `#858C85` (30% opacity). Active track: `#151915`. Thumb: 28px diameter white circle. When active, thumb contains a centered 6px dot in `#A7E66A`.
- **Checkbox:** 22x22px square, 6px border radius. Active: `#151915` background with `#A7E66A` checkmark stroke.

### Live Elevation Profile & Surface Graph
- Container: `#FFFFFF` card, 16px radius, padding 16px. Chart area height 72px. Base line in `#858C85` (30%). Area fill: vertical gradient from `rgba(167, 230, 106, 0.5)` to `rgba(234, 247, 220, 0.02)`. Active cyclist position: 8px `#151915` dot with 2px white halo and vertical reference guide line.