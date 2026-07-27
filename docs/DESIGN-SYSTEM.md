# Design system

ASTRA is built on **VBDS v2.0** — the VelPOS Design System at `~/MyStuff/designsystem`
(`@velbloom/vbds`). This document records exactly what was ported, what was kept, and what was
changed, so the relationship stays legible as both evolve.

---

## The starting position

VBDS was authored for a **1280×800 Android tablet point-of-sale app**. Its own
`screen-generation-rules.md` states the constraints plainly:

> Every screen must look like a production Android tablet app by a top-tier product team — never
> a website, never a marketing page.
>
> **Anti-patterns (hard no):** new one-off components · web/marketing layouts · glassmorphism,
> neumorphism, heavy blur · more than one primary action · random colors outside the tokens.

ASTRA is a desktop-first enterprise web app with a glass header and 21-column data tables. The
two briefs genuinely conflict. Three decisions were confirmed before any code was written:

| Decision | Choice |
|---|---|
| Brand | ASTRA blue `#2563EB`, applied through the VBDS token architecture |
| Components | Vendor VBDS into the app + add a desktop density tier + Radix for primitives VBDS lacks |
| Data | Full Prisma/PostgreSQL schema as a deliverable, in-memory adapter as the runnable default |

---

## Token architecture

`src/styles/tokens.css` keeps **every VBDS variable name identical** — `--vbds-primary`,
`--vbds-radius-card`, `--vbds-shadow-raised`, the whole set. Only the *values* changed.

This is deliberate: a component copied from `designsystem/src` drops into ASTRA unmodified,
and a future VBDS update can be diffed rather than re-derived.

### Three cascade layers

```css
:root                     /* brand + comfortable (tablet) scale = VBDS geometry */
[data-density='compact']  /* desktop enterprise density — the app default        */
[data-theme='dark']       /* dark surfaces                                       */
```

### Brand mapping

| Token | VelPOS | ASTRA |
|---|---|---|
| `--vbds-primary` | `#ea5b0c` orange | `#2563eb` blue |
| `--vbds-primary-hover` | `#d14f06` | `#1d4ed8` |
| `--vbds-primary-subtle` | `#fff1e7` | `#eff6ff` |
| `--vbds-bg` | `#f7f8fa` | `#f8fafc` slate-50 |
| `--vbds-text` | `#1a1a1a` | `#0f172a` slate-900 |
| `--vbds-text-secondary` | `#6b7280` | `#64748b` slate-500 |
| `--vbds-border` | `#e5e7eb` | `#e2e8f0` slate-200 |

New tokens ASTRA adds, following the same naming convention:

`--vbds-secondary` (teal `#14b8a6`) · `--vbds-accent` (indigo `#6366f1`) ·
`--vbds-glass` / `--vbds-glass-border` / `--vbds-glass-blur` ·
`--vbds-font-mono` · `--vbds-chart-1…8` · `--vbds-seq-1…7` ·
`--vbds-cat-*` (chemical application colours, replacing VelPOS's food categories) ·
`--astra-sidebar-width`, `--astra-topbar-height`, `--astra-row-height`

### Density tier

VBDS geometry is tablet-scale. The compact tier tightens it for desktop while leaving the 8-point
spacing rhythm and every brand/status token untouched:

| Token | Comfortable (VBDS) | Compact (ASTRA default) |
|---|---|---|
| `--vbds-control-height` | 56px | **38px** |
| `--vbds-touch-target` | 48px | **34px** |
| `--vbds-radius-card` | 24px | **16px** |
| `--vbds-radius-button` | 18px | **10px** |
| `--vbds-radius-input` | 16px | **10px** |
| `--vbds-body-size` | 15px | **14px** |
| `--vbds-headline-size` | 24px | **20px** |
| `--vbds-display-size` | 32px | **28px** |

Net effect: roughly 30% more table rows per screen. Users can switch back to Comfortable in
**Settings → Preferences**, which removes the `data-density` attribute and restores VBDS geometry
exactly.

---

## Component port

`src/components/vbds/` — grouped by the stylesheet each set belongs to, mirroring the design
system's own CSS file split.

| File | Components | Origin |
|---|---|---|
| `actions.tsx` | Button, IconButton | Ported |
| `inputs.tsx` | TextField, TextArea, SearchField, Select, Switch, Checkbox, SegmentedControl | Ported (TextArea added) |
| `display.tsx` | Card, CardHeader, StatCard, EmptyState, Badge, Chip, Avatar, Divider, ListItem, DescriptionList | Ported |
| `navigation.tsx` | Tabs, LinkTabs, Breadcrumbs | Tabs ported; LinkTabs and Breadcrumbs new |
| `feedback.tsx` | Spinner, ProgressBar, Skeleton, TableSkeleton, StatGridSkeleton | Ported + compositions |
| `overlays.tsx` | Dialog, Sheet, Menu, Tooltip | Rebuilt on Radix |

### Deviations, and why

**1. Icons are Lucide `ReactNode`, not Material Symbols strings.**
VBDS took `icon="shopping_cart"` and rendered a ligature font. The ASTRA brief specifies Lucide.
Icon props are now `ReactNode`: `icon={<Plus size={14} />}`. One consistent icon system beats
partial fidelity to two.

**2. Overlays wrap Radix.**
The VBDS `Dialog` and `BottomSheet` were raw divs with a click-to-close scrim — no focus trap, no
Escape handling, no return focus. Not enough for an enterprise app. They now wrap Radix primitives
while keeping the exact VBDS class names and visual treatment.

**3. `BottomSheet` became a right-side `Sheet`.**
A bottom sheet is a touch pattern. ASTRA is desktop-first.

**4. Fields forward refs and spread native props.**
So they compose with React Hook Form's `register()` without a `Controller` wrapper.

**5. POS-specific components were not ported.**
Keypad, PinField, CurrencyField, QuantityStepper, ReceiptCard, OrderCard, PaymentMethodCard,
CustomerCard, ProductCard, CategoryCard, BottomNav, NavigationRail, Toast, BarChart, Sparkline.
None have a chemical-intelligence equivalent. Toasts use Sonner; charts use Recharts and the
custom marks below.

**6. Glass surfaces are used, against the VBDS anti-pattern list.**
The topbar and the search panel use `backdrop-filter`. The ASTRA brief asks for a glass header
explicitly, and the VBDS rule was written for a tablet POS. Blur is limited to 14px on two
sticky surfaces — it is not applied to cards, dialogs or content.

---

## Class-name convention

| Prefix | Meaning |
|---|---|
| `vbds-*` | Design system component — ported, restyled only through tokens |
| `astra-*` | App-level composition with no design system equivalent |

`astra-*` covers the shell, data table, command palette, search panel, wizard, timeline,
equipment cards, report cards and chart marks. Both build exclusively from `--vbds-*` tokens —
there are no hand-picked colours anywhere in `astra.css`.

---

## Tailwind bridge

Tailwind v4's `@theme inline` maps utilities onto VBDS tokens:

```css
@theme inline {
  --color-primary: var(--vbds-primary);
  --color-surface: var(--vbds-surface);
  --radius-card:   var(--vbds-radius-card);
  --shadow-card:   var(--vbds-shadow-card);
  /* … */
}
```

`inline` matters: it emits `var()` references rather than snapshotting values, which is what makes
runtime light/dark switching work. `bg-primary` and `.vbds-button--primary` resolve to the same
variable, so utilities and design system components can never drift apart.

---

## Chart palette — validated, not eyeballed

The categorical palette was run through the dataviz validator in both modes rather than chosen by
taste. The first attempt **failed**: brand blue `#2563eb` and indigo `#6366f1` are ΔE 1.9 apart
under protanopia and ΔE 6.6 under normal vision — effectively the same colour. The dark steps
were also too light for the dark lightness band (L 0.48–0.67).

The shipped palette puts ASTRA blue in slot 1 of a validated eight-hue order:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | blue (brand) | `#2563eb` | `#3b82f6` |
| 2 | orange | `#eb6834` | `#d95926` |
| 3 | aqua | `#1baf7a` | `#199e70` |
| 4 | yellow | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | green | `#008300` | `#008300` |
| 7 | violet | `#4a3aa7` | `#9085e9` |
| 8 | red | `#e34948` | `#e66767` |

**Validator results** (adjacent pairlist — bars, lines, stacks):

| Check | Light | Dark (surface `#131924`) |
|---|---|---|
| Lightness band | PASS | PASS |
| Chroma floor | PASS | PASS |
| CVD separation | PASS — worst adjacent ΔE 9.1 (protan) | PASS — worst adjacent ΔE 8.4 (protan) |
| Normal-vision floor | PASS — worst adjacent ΔE 19.6 | PASS — worst adjacent ΔE 19.3 |
| Contrast vs surface | WARN — slots 3/4/5 below 3:1 | PASS — all ≥ 3:1 |

### Rules this produces

- **Assign in fixed order, never cycled.** `assignSeries()` folds a ninth series into "Other"
  rather than generating a hue.
- **All-pairs forms cap at 3 slots.** Only the first three clear the all-pairs floors in both
  modes. `ALL_PAIRS_CAP = 3`.
- **The light-mode contrast WARN obligates relief.** Every chart ships visible value labels *and*
  a table view — that's what `ChartCard`'s table toggle is for, not decoration.
- **Dark steps are selected, not flipped.** They were re-stepped for the dark lightness band and
  validated against the dark surface as a set.

### Chart form choices

| Job | Form | Why |
|---|---|---|
| Compare magnitudes across named categories | Horizontal bars, single hue, direct labels | Identity comes from the row label, so no categorical slot is consumed |
| Composition of a whole | One 100% stacked bar | A donut makes every slice adjacent to every other — the all-pairs case, where only 3 slots pass |
| Change over time | Line, **one shared axis**, 2 series | Never a dual axis; two y-scales manufacture correlation |

Mark specs follow the skill: 4px rounded data-ends anchored to the baseline, 2px line strokes,
8px active dots, a 2px surface gap between stacked segments, recessive horizontal-only gridlines,
and text in ink tokens rather than series colours.

---

## Working with the design system

**Do:**
- Compose from `vbds-*` components; add `astra-*` only for genuinely new compositions.
- Use `--vbds-*` tokens for all spacing, radii, colour and motion.
- Keep one primary action per screen — a rule worth keeping from VBDS.
- Re-run `scripts/validate_palette.js` if you touch `--vbds-chart-*`.

**Don't:**
- Hard-code a colour, radius or shadow.
- Restyle a `vbds-*` component's internals from a page — change the token instead.
- Add a ninth chart series.
- Use a donut with more than three slices.
