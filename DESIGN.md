---
name: i18n-ast-lint
description: Precision AST static-analysis workbench and dead-key pruner for TypeScript, React, and Next.js
colors:
  obsidian-canvas: "#0B0E14"
  graphite-panel: "#11161F"
  slate-elevated: "#171E2B"
  hairline-border: "#263042"
  active-border: "#3B4A63"
  alabaster-ink: "#F4F6F8"
  steel-secondary: "#A3B1C6"
  muted-coordinate: "#8B9BB4"
  emerald-signal: "#10B981"
  emerald-deep: "#064E3B"
  crimson-diagnostic: "#F43F5E"
  amber-unused: "#F59E0B"
  cyan-dynamic: "#38BDF8"
typography:
  display:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.emerald-signal}"
    textColor: "{colors.obsidian-canvas}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "{colors.slate-elevated}"
    textColor: "{colors.alabaster-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card-panel:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.alabaster-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: i18n-ast-lint

## Overview

**Creative North Star: "The Precision Compiler Workbench"**

`i18n-ast-lint` is an Operate-mode static-analysis instrument built for working engineers. Its visual language rejects the ornamental habits of AI-generated developer landing pages—no purple-to-cyan gradients, no glowing status dots, no decorative eyebrow pills above headings, no bento mosaics, and no fake traffic-light terminal costumes. Instead, the interface behaves like a calibrated compiler inspector: dense, high-contrast, keyboard-native, and anchored by the live CodeMirror AST buffer and real-time diagnostic ledger.

Every pixel serves inspection speed. Typography pairs **IBM Plex Sans** for crisp UI hierarchy with **JetBrains Mono** strictly reserved for code buffers, AST key paths, line/column coordinates, and CLI invocations. Tonal separation is achieved through crisp 1px structural borders (`#263042`) across stepped obsidian-to-graphite surfaces (`#0B0E14` -> `#11161F` -> `#171E2B`) rather than blurred glassmorphism or floating drop shadows.

**Key Characteristics:**
- **Operate-First First Viewport:** The workspace header, framework fixture switcher, split CodeMirror editor, and live AST diagnostic ledger occupy the primary viewport without marketing filler above them.
- **One Deliberate Action Accent:** Signal Emerald (`#10B981`) is reserved exclusively for the primary surgical `--fix` action and verified zero-error completion states (`7.61:1` contrast with `#0B0E14` text).
- **Semantic Diagnostic Triplets:** Every diagnostic pairs a non-color text code (`MISSING_KEY`, `INTERPOLATION_MISMATCH`, `UNUSED_KEY`, `DYNAMIC_KEY_DETECTED`), a locale file tag (`fr.json`), and a clickable `file:line:col` coordinate.
- **Custom Browser Surfaces:** Scrollbars, text selection, tabular numerals (`font-variant-numeric: tabular-nums`), and `:focus-visible` rings are deliberately themed to match the workbench palette.

## Colors

A disciplined low-emission dark workbench palette engineered for long coding sessions and verified against WCAG 2.2 AA contrast thresholds.

### Primary
- **Signal Emerald** (`#10B981`): The single primary action accent, used on the surgical `--fix` trigger and clean exit-code `0` verification banner. Paired with Obsidian Canvas (`#0B0E14`) foreground text at **7.61:1** contrast.
- **Deep Emerald Surface** (`#064E3B`): Tonal container fill for added/retained diff lines and active zero-error status banners.

### Secondary
- **Slate Elevated** (`#171E2B`): Interactive control surface for secondary buttons, inactive file tabs, and hover states on diagnostic rows.

### Tertiary
- **Crimson Diagnostic** (`#F43F5E`): Marks `MISSING_KEY` and `INTERPOLATION_MISMATCH` error tokens and removed diff lines.
- **Amber Unused** (`#F59E0B`): Marks `UNUSED_KEY` prunable entries.
- **Cyan Dynamic** (`#38BDF8`): Marks `DYNAMIC_KEY_DETECTED` protected template literal prefixes.

### Neutral
- **Obsidian Canvas** (`#0B0E14`): Root document background.
- **Graphite Panel** (`#11161F`): Primary workbench container background for the editor, diagnostic ledger, and CI exporter.
- **Hairline Border** (`#263042`): 1px structural divider separating panes, toolbar rows, and diagnostic ledger items.
- **Active Border** (`#3B4A63`): Emphasized border for focused panes and selected preset triggers (≥ 3:1 non-text contrast against adjacent dark surfaces).
- **Alabaster Ink** (`#F4F6F8`): Primary reading and code foreground text (**17.83:1** contrast on Obsidian Canvas).
- **Steel Secondary** (`#A3B1C6`): Secondary descriptions and inactive tab labels (**8.34:1** contrast on Graphite Panel).
- **Muted Coordinate** (`#8B9BB4`): File paths, line/column numbers, and millisecond telemetry (**5.92:1** contrast on Graphite Panel, passing WCAG AA normal text).

### Named Rules
**The One Accent Rule.** Signal Emerald (`#10B981`) appears only on the primary `--fix` action button, active tab indicator bar, and clean exit-code `0` states. Never spread it across decorative borders, icons, or background glows.

**The Zero-Gradient Rule.** Do not use blue-to-purple gradients, radial background orbs, or gradient text anywhere in the application.

## Typography

**Display & UI Font:** `IBM Plex Sans` (with system sans-serif fallback)
**Code & Coordinate Font:** `JetBrains Mono` (with `ui-monospace, SFMono-Regular` fallback)

**Character:** Industrial clarity. `IBM Plex Sans` provides technical legibility at compact dashboard sizes (`13px–18px`) without the generic softness of default SaaS landing pages, while `JetBrains Mono` keeps AST key paths, line numbers, and JSON diffs scannable with `tabular-nums`.

### Hierarchy
- **Display** (`600`, `1.5rem` / `24px`, line-height `1.25`, tracking `-0.02em`): Top workbench title. Fixed `rem` scale per Operate-mode rules (no fluid `clamp()`).
- **Headline** (`600`, `1.125rem` / `18px`, line-height `1.35`, tracking `-0.015em`): Drawer and section titles (`--fix` Diff Inspector, GitHub Actions CI Gate).
- **Title** (`600`, `0.875rem` / `14px`, line-height `1.4`, tracking `-0.01em`): Preset triggers, active panel headers, and primary action buttons.
- **Body** (`400`, `0.875rem` / `14px`, line-height `1.55`): Diagnostic explanations and architectural notes (constrained to `65–75ch` max measure).
- **Label / Mono** (`500`, `0.75rem` / `12px`, line-height `1.4`): Diagnostic type codes, `file:line:col` coordinates, CLI commands, and tabular counters.

### Named Rules
**The Monospace Discipline Rule.** Use `JetBrains Mono` strictly for source code, translation key IDs, file paths, line/column coordinates, exit codes, and CLI commands. Never set prose headings or descriptive sentences in monospace.

**The No-Eyebrow Rule.** Never place an uppercase pill badge or kicker label above the `<h1>` heading.

## Layout

The interface uses an **Operate-mode split-pane workbench** (`max-w-[1440px]`, centered with `16px` mobile / `24px` desktop horizontal gutters):
1. **Compact Workbench Header Bar:** Single horizontal bar pairing the product title, real-time CLI equivalent command (`npx i18n-ast-lint check`), and the 3-way framework fixture segmented control (`react-i18next`, `next-intl`, `react-intl`).
2. **Primary Split Workspace (12-Column Grid on `lg+`):**
   - **Left 7 Columns (`58%`):** Multi-buffer CodeMirror 6 editor with file tabs (`source.tsx`, `locales/en.json`, `locales/fr.json`), live line count, and active line highlight status.
   - **Right 5 Columns (`42%`):** AST Diagnostic Ledger with filter pills by diagnostic type (`All`, `Missing`, `Mismatch`, `Unused`, `Dynamic`), real-time AST scan latency in milliseconds, and the primary **`Preview --fix`** trigger.
3. **Inline Expandable `--fix` Diff Drawer:** Opens directly above the workspace when triggered (no screen-blocking modal backdrop), showing side-by-side `jsonc-parser` unified diffs with **`Apply Fix to Buffer`**.
4. **Bottom Reference Strip:** Two-column engineering reference combining the **GitHub Actions CI Gate generator** (`pnpm`, `npm`, `yarn`, `bun`) and the **Adversarial Capability Matrix** (`i18n-ast-lint` vs. regex `i18n-unused`).

## Elevation & Depth

Depth is communicated through **tonal surface layering and crisp 1px borders**, not drop shadows or backdrop blur.

### Named Rules
**The Flat-By-Default Rule.** All panels sit flat on the Obsidian Canvas (`#0B0E14`) separated by `1px solid #263042`. No glassmorphism (`backdrop-filter: blur`) or multi-layered drop shadows are permitted on cards.

## Shapes

- **Workbench Panels & Editor Containers:** `8px` (`rounded-md`) corner radius with `1px solid #263042` border.
- **Buttons, File Tabs & Segmented Controls:** `6px` (`rounded-sm`) corner radius—distinct from containers and never pill-shaped (`9999px`).
- **Diagnostic Type Tokens:** `4px` (`rounded-xs`) tight technical tags.

## Components

### Buttons
- **Shape:** Technical `6px` radius (`rounded-sm`), `cursor: pointer` on all enabled buttons, `cursor: not-allowed` when disabled.
- **Primary (`Preview --fix` / `Apply Fix`):** Signal Emerald background (`#10B981`), Obsidian Canvas text (`#0B0E14`), `font-weight: 600`, `padding: 6px 12px`. Hover shifts to `#34D399`; focus shows a `2px solid #F4F6F8` ring with `2px` offset.
- **Secondary (`Copy YAML`, `Reset Fixture`):** Slate Elevated (`#171E2B`) with `1px solid #263042` border and Alabaster Ink text (`#F4F6F8`). Hover shifts border to `#3B4A63` and background to `#1E293B`.

### File Tabs & Preset Switcher
- **Style:** Segmented control bar in `#0B0E14` with `1px solid #263042` border.
- **State:** Active tab uses `#171E2B` background, Alabaster Ink text (`#F4F6F8`), and a `2px` bottom Signal Emerald bar (`#10B981`) so active state is distinguishable by shape as well as color.

### Diagnostic Ledger Rows
- **Style:** Full-width `<button type="button">` rows inside the ledger list, separated by `1px solid #1E2636` dividers.
- **Interaction:** Clicking any row switches the editor to the target file tab, scrolls the CodeMirror buffer to the exact line, highlights the line, and marks the diagnostic row as selected (`aria-current="true"`).
- **No Left Color Stripe:** Per Craft Floor and Anti-Slop rules, diagnostic rows do NOT use a thick decorative `border-left`. Severity is communicated through the explicit semantic badge (`MISSING_KEY`, `INTERPOLATION_MISMATCH`, `UNUSED_KEY`, `DYNAMIC_KEY_DETECTED`) and structured variable diff chips.

## Do's and Don'ts

### Do:
- **Do** lead immediately with the working AST editor and live diagnostic ledger in the first viewport.
- **Do** verify every foreground/background text pairing at ≥ 4.5:1 contrast (`#8B9BB4` or lighter on `#11161F`).
- **Do** pair every diagnostic color cue with an explicit monospace type code, locale badge, and `file:line:col` coordinate.
- **Do** provide a "Reset Fixture" action so evaluators who apply `--fix` or edit code can restore the preset in one click.

### Don't:
- **Don't** place an eyebrow pill badge, pulsing status dot, or gradient headline above the workbench title.
- **Don't** use decorative emoji (`🚀`, `✨`, `🔥`, `✅`) anywhere in headings, buttons, or diagnostic messages; use crisp inline SVG icons with `aria-hidden="true"`.
- **Don't** use thick colored `border-left` stripes on cards or diagnostic rows.
- **Don't** fabricate download counts, customer logos, or unmeasured latency numbers.
