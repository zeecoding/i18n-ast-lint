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

`i18n-ast-lint` is an Operate-mode static-analysis instrument built for working engineers. Its visual language rejects the ornamental habits of AI-generated developer landing pages—no purple-to-cyan gradients, no glowing status dots, no decorative eyebrow pills above headings, no bento mosaics, and no fake traffic-light terminal costumes.

**Key Characteristics:**
- **Operate-First First Viewport**
- **One Deliberate Action Accent (`#10B981`)**
- **Semantic Diagnostic Triplets**
- **Custom Browser Surfaces**

## Colors

A disciplined low-emission dark workbench palette engineered for long coding sessions and verified against WCAG 2.2 AA contrast thresholds.

### Primary
- **Signal Emerald** (`#10B981`): Primary action accent (`--fix` trigger and clean exit-code `0` banner).
- **Deep Emerald Surface** (`#064E3B`): Tonal container fill for added/retained diff lines.

### Secondary
- **Slate Elevated** (`#171E2B`): Interactive control surface for secondary buttons and active tabs.

### Tertiary
- **Crimson Diagnostic** (`#F43F5E`): Marks `MISSING_KEY` and `INTERPOLATION_MISMATCH` errors.
- **Amber Unused** (`#F59E0B`): Marks `UNUSED_KEY` prunable entries.
- **Cyan Dynamic** (`#38BDF8`): Marks `DYNAMIC_KEY_DETECTED` protected template literal prefixes.

### Neutral
- **Obsidian Canvas** (`#0B0E14`): Root document background.
- **Graphite Panel** (`#11161F`): Primary workbench container background.
- **Hairline Border** (`#263042`): 1px structural divider.
- **Active Border** (`#3B4A63`): Focused/selected control border.
- **Alabaster Ink** (`#F4F6F8`): Primary text (`17.83:1` contrast).
- **Steel Secondary** (`#A3B1C6`): Secondary descriptions (`8.34:1` contrast).
- **Muted Coordinate** (`#8B9BB4`): File paths and line/column coordinates (`5.92:1` contrast).

## Typography

**Display & UI Font:** `IBM Plex Sans`
**Code & Coordinate Font:** `JetBrains Mono`

## Layout

Split-pane Operate workbench (`max-w-[1440px]`) with 7-column CodeMirror buffer on the left and 5-column AST Diagnostic Ledger on the right.

## Elevation & Depth

Flat-by-default tonal layering (`#0B0E14` -> `#11161F` -> `#171E2B`) separated by `1px solid #263042` borders.

## Shapes

`8px` panel radius, `6px` button/tab radius, `4px` diagnostic tag radius.

## Components

### Buttons
- **Primary:** Signal Emerald (`#10B981`) with `#0B0E14` ink, `6px` radius.
- **Secondary:** Slate Elevated (`#171E2B`) with `#F4F6F8` ink and `1px solid #263042` border.

## Do's and Don'ts

### Do:
- **Do** lead with the working AST editor and live diagnostic ledger in the first viewport.
- **Do** maintain >= 4.5:1 contrast on all normal text and >= 3:1 on borders/controls.

### Don't:
- **Don't** place an eyebrow pill badge above the `<h1>` heading.
- **Don't** use thick colored `border-left` stripes or decorative emoji.
