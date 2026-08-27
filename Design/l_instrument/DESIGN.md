---
name: L'Instrument
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#45474c'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#76777c'
  outline-variant: '#c6c6cc'
  surface-tint: '#585e6c'
  primary: '#030813'
  on-primary: '#ffffff'
  primary-container: '#1a202c'
  on-primary-container: '#828796'
  inverse-primary: '#c1c6d7'
  secondary: '#b6191a'
  on-secondary: '#ffffff'
  secondary-container: '#d9352f'
  on-secondary-container: '#fffbff'
  tertiary: '#000b04'
  on-tertiary: '#ffffff'
  tertiary-container: '#002614'
  on-tertiary-container: '#43976a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde2f3'
  primary-fixed-dim: '#c1c6d7'
  on-primary-fixed: '#161c27'
  on-primary-fixed-variant: '#414754'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000b'
  tertiary-fixed: '#9ff5c1'
  tertiary-fixed-dim: '#83d8a6'
  on-tertiary-fixed: '#002111'
  on-tertiary-fixed-variant: '#005231'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  paper-cool: '#F4F7F6'
  ink-navy: '#101827'
  correction-brick: '#9E3D31'
  success-muted: '#E6F4EA'
  progress-blue: '#3B82F6'
  border-quiet: '#E5E7EB'
typography:
  display-fr:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg-serif:
    fontFamily: Libre Caslon Text
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  quiz-option:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1024px
  content-column: 680px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built on the concept of a **focused personal language notebook** paired with a **precise study instrument**. It avoids the generic "AI SaaS" aesthetic, opting instead for a mature, editorial, and professional tone tailored for serious TCF Canada preparation.

The visual style is **Modern Minimalism with an Editorial lean**. It prioritizes high-quality typography, intentional whitespace, and thin rules over floating cards and heavy drop shadows. The UI should feel like a well-designed reference book: calm, structured, and intellectual.

**Key Principles:**
- **Calm Productivity:** No unnecessary animations or gamified noise.
- **Instrument Precision:** Every element serves a functional purpose in the study journey.
- **Editorial Texture:** Using subtle paper-like background tones and literary serif fonts to evoke the feeling of physical study materials.

## Colors

The palette is restrained, using color primarily for semantic feedback rather than decoration.

- **Primary (Ink):** A deep charcoal or ink-navy used for almost all text and structural lines.
- **Secondary (Correction):** A brick-red/coral used sparingly for "handwritten" annotations, errors, or critical actions.
- **Neutral (Paper):** A light, cool-tinted paper background that reduces eye strain during long study sessions.
- **Semantic Colors:** Muted greens for success and quiet blues for progress/audio states.

Color should be applied with an "annotation" mindset—as if a teacher is marking a page.

## Typography

Typography is the core of this design system. It establishes a hierarchy that distinguishes between study content and application UI.

- **The French Voice:** All French headwords and example sentences use **Libre Caslon Text**. This provides a literary, authoritative feel that signals "the object of study."
- **The Application Voice:** UI controls, labels, and secondary translations use **Public Sans**. It is neutral, legible, and institutional, ensuring clarity without competing with the French content.

**Usage Rules:**
- Use `display-fr` for the primary word on the learning screen.
- Use `body-lg-serif` for French example sentences.
- Use `label-caps` for metadata like "PART OF SPEECH" or "SOURCE."
- Support for Chinese characters should be handled by a high-quality sans-serif fallback (e.g., Noto Sans SC) that matches the weight of Public Sans.

## Layout & Spacing

The layout philosophy follows a **fixed-width structured column** approach rather than fluid expansion. This maintains comfortable reading lengths for linguistic content.

- **Desktop Logic:** Navigation is placed in a quiet, narrow left sidebar. The main content resides in a central column (max 680px for reading comfort). Side panels are used for contextual details (e.g., dictionary notes) rather than nested cards.
- **The "Notebook" Grid:** Instead of cards, use thin horizontal rules (`1px`) to separate sections. Elements are aligned to a strict vertical axis to create a sense of order.
- **Mobile Adaption:** For mobile, the 4-option quiz occupies the lower half of the screen for thumb-reach, while the French headword remains centered at the top.

## Elevation & Depth

This design system avoids traditional shadows and "floating" layers to maintain a flat, paper-like aesthetic.

- **Tonal Layering:** Depth is conveyed through subtle background color shifts (e.g., a slightly darker gray for a sidebar) rather than elevation.
- **Low-Contrast Outlines:** Use `1px` borders in `border-quiet` to define input fields and answer rows. 
- **Focus States:** Instead of heavy glows, use a solid `2px` ink-navy border for keyboard focus and active selection.
- **Zero-Shadow Policy:** No shadows are used on cards or buttons. Depth is purely a matter of layering and rules.

## Shapes

The shape language is "Soft" but disciplined. 

- **Primary Radius:** `0.25rem` (4px) is the standard for buttons, input fields, and answer rows. This provides enough softness to feel modern but remains sharp enough to look professional.
- **Large Radius:** `0.5rem` (8px) is reserved for larger structural containers, though these should be used sparingly.
- **Interactive Elements:** Success/Error states in the quiz should use the standard primary radius. Avoid pill-shaped buttons; prefer rectangles with subtle rounding.

## Components

### Buttons & Inputs
- **Primary Action:** Solid `ink-navy` background with `neutral-paper` text. No gradients.
- **Secondary Action:** Ghost style with `1px border-quiet` and `ink-navy` text.
- **Inputs:** Simple `1px` bottom border or a full subtle outline. No heavy inset shadows.

### The "Instrument" Quiz Row
- **Default State:** A simple row with `1px border-quiet`. 
- **Hover State:** Background shifts to `paper-cool`.
- **Selected State:** Border thickens to `2px ink-navy`.
- **Feedback States:** Correct answers use a `success-muted` background and green text; incorrect selections use a `correction-brick` text treatment with a strike-through or "handwritten" cross icon.

### Notebook Sections
- Replace cards with **Full-width Dividers**. A section should start with a `label-caps` heading followed by a thin rule, then the content, then another rule.

### Audio Controls
- Display as a button with a "Play" icon and the text "Play Word" or "Play Sentence". Do not use icon-only buttons for primary study actions.