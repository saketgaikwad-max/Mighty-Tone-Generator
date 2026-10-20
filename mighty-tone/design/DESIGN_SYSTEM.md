# Mighty Tone Generator — Design System Recommendation

## Recommendation
**Konsta UI v5 (iOS theme, React + Tailwind)**, with a custom dark "Midnight Studio" token layer on top.

- Konsta is the only candidate whose whole design goal is pixel-faithful iOS components (navbar, grouped lists, sheets, segmented, toggles, steppers, toolbars/tab bar, toasts, chips) delivered as plain Tailwind classes — so it feels native on iPhone and scales to Mac widths with normal Tailwind layout.
- MIT license, active (v5.5.0 released 2026-09-28, commits within the last week at review time).
- Tiny footprint: components are thin React wrappers + Tailwind utilities (tree-shaken, no runtime router or framework). Compare Framework7/Ionic, which bring their own routing/app shell.
- Gaps (combobox, popover, tooltip, keyboard focus traps for desktop panes) are filled with **Radix primitives** (MIT) styled with the same tokens, only where needed.

**Font:** system stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif` (true SF on Apple devices; Inter, OFL, as fallback elsewhere). Tabular numerals (`font-variant-numeric: tabular-nums`) for parameter values and ms.
**Icons:** **Lucide** (ISC) — SF-Symbols-like stroke style, 1.75px stroke at 22px. Guitar / mandolin glyphs custom-drawn in the same style.

## Comparison (checked via GitHub API, Oct 2026)

| Kit | License | Latest release | Apple feel | Dark | Coverage | Notes |
|---|---|---|---|---|---|---|
| **Konsta UI** | MIT | v5.5.0, 2026-09-28 | Excellent (iOS theme) | Good, token-overridable | Lists, sheets, segmented, sliders, chips, tabbar, toasts, stepper | Tailwind-native, smallest |
| Framework7 | MIT | v9.2.0, 2026-09-28 | Excellent | Good | Most complete | Brings its own router/app shell; heavier, less idiomatic in React |
| Ionic (iOS mode) | MIT | v9.0.8, 2026-10-14 | Very good | Good | Very complete, strong a11y | Web Components + shadow DOM, heaviest; harder to restyle to custom glass look |
| shadcn/ui + Radix | MIT | 4.22.1, 2026-10-18 | Neutral (needs iOS theme) | Excellent | Strong desktop, weak mobile idioms (no iOS list/sheet look) | Best a11y; great complement for desktop |
| HeroUI | Apache-2.0 | v3.2.6, 2026-09-17 | Modern, not iOS | Good | Broad | Own look; fights a native feel |
| Ark UI / Park UI | MIT | ark 5.x, 2026-10 | Neutral | Good | Headless | More assembly work |

Accessibility: Konsta uses native elements (buttons, inputs, range); we add `aria-*` on custom sliders/segments, honour `prefers-reduced-motion`, keep 44pt min targets, and check contrast ≥ 4.5:1 for text on glass.

## Visual direction: "Midnight Studio"
Near-black navy base, layered translucent glass cards (`backdrop-filter: blur(24px) saturate(160%)`), one violet→blue accent glow reserved for *active / primary* things (current tone, primary button, active slider fill, live QR). Mood references (music-player shots) inform atmosphere only; layout follows iOS conventions (large titles, grouped lists, bottom sheets).

## Tokens

### Color
| Token | Value | Use |
|---|---|---|
| `bg/base` | `#0B0D14` | App background |
| `bg/raised` | `#141826` | Cards (opaque fallback) |
| `glass/fill` | `rgba(28,32,52,0.62)` | Glass cards, sheets, tab bar |
| `glass/stroke` | `rgba(255,255,255,0.08)` | 1px hairline |
| `text/primary` | `#F2F3F8` | |
| `text/secondary` | `#9AA0B8` | |
| `text/tertiary` | `#62677E` | |
| `accent/500` | `#7C6CFF` | Primary, active |
| `accent/400` | `#9A8CFF` | Hover/pressed text |
| `accent/blue` | `#4F8BFF` | Gradient end |
| `accent/glow` | `0 0 24px rgba(124,108,255,.45)` | Active glow |
| `conf/high` | `#34D399` | Confidence High |
| `conf/med` | `#FBBF24` | Confidence Medium |
| `conf/low` | `#F87171` | Confidence Low / destructive |

Gradient `accent`: `linear-gradient(135deg,#7C6CFF,#4F8BFF)`. Light theme: deferred (dark-first), tokens structured to allow it.

### Radius
`xs 8` (chips inner) · `sm 12` (inputs, blocks) · `md 18` (cards) · `lg 26` (sheets, phone-level panels) · `full 999` (pills, toggles, slider thumbs).

### Spacing (4pt grid)
`4, 8, 12, 16, 20, 24, 32, 44`. Screen gutter 16; card padding 16; min touch target 44.

### Type scale (SF / Inter)
| Style | Size/Line | Weight |
|---|---|---|
| Large Title | 34/41 | 700 |
| Title 2 | 22/28 | 700 |
| Headline | 17/22 | 600 |
| Body | 17/22 | 400 |
| Callout | 16/21 | 400 |
| Subhead | 15/20 | 400 |
| Footnote | 13/18 | 400 |
| Caption | 12/16 | 500 (uppercase for section labels, +0.4 tracking) |
| Mono value | 13/16 tabular | 500 |

### Elevation / glass
- `e0`: flat, hairline only.
- `e1` card: glass fill + stroke + `0 8px 24px rgba(0,0,0,.35)`.
- `e2` sheet / tab bar: glass fill (blur 30) + `0 -8px 40px rgba(0,0,0,.5)`.
- `glow`: active item adds `accent/glow` (one per screen max).

### Motion
`fast 120ms` (press, toggle) · `base 220ms` (chip, segmented, card expand) · `sheet 360ms` (sheets, push) · easing `cubic-bezier(.32,.72,0,1)` (iOS spring-like); confidence/QR reveal 280ms fade+scale .96→1. All disabled/cross-fade under `prefers-reduced-motion`.

## Key components (mapping)
Navbar large title, Searchbar, List (grouped/inset), Segmented, Stepper, Toggle, Range (read-only variant for signal chain), Chip (selectable), Sheet (delay helper, LLM handoff, feedback), Tabbar (4 tabs), Toast (saved/copied). Custom: QR card, Confidence badge, Signal-chain strip (9 pills), Version timeline, Frequency-response chart (SVG), IR slot grid.

## Desktop / Mac
≥ 1024px: three panes — sessions sidebar (280) · chat (flex) · inspector (360: result card, signal chain, versions). Tab bar becomes the sidebar's top segment.
