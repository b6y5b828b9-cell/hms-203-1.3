# Care Operations Design System

## Direction
A calm, high-clarity interface for repeated clinical and operational work. Bright paper-like work surfaces sit on a cool green-gray canvas, with deep ink navigation, teal actions, and restrained coral emphasis for urgent attention. The system prioritizes scanability, accessible contrast, and compact but breathable data layouts.

## Color Tokens

| Token | Light value | Use |
| --- | --- | --- |
| `--app-canvas` | `#eef3f2` | Main workspace background |
| `--surface-header` | `#ffffff` | Global header and action ribbon |
| `--surface-nav` | `#173640` | Primary navigation rail |
| `--surface-card` | `#ffffff` | Panels, forms, and data surfaces |
| `--surface-raised` | `#f7faf9` | Secondary rows and quiet sections |
| `--brand-primary` | `#087d78` | Primary actions, selected navigation, focus |
| `--brand-primary-hover` | `#086965` | Hover and pressed primary controls |
| `--brand-secondary` | `#365f70` | Secondary actions and informational accents |
| `--brand-accent` | `#c96c52` | Limited emphasis; avoid using for routine actions |
| `--text-primary` | `#192f36` | Main text and headings |
| `--text-secondary` | `#61757b` | Supporting text and metadata |
| `--text-nav` | `#edf6f5` | Text on navigation |
| `--border-subtle` | `#dce6e4` | Dividers and control borders |
| `--brand-tint` | `#e4f3f0` | Selected and low-emphasis brand surfaces |

Ocean, Indigo, and Dark presets override the same semantic variables in `src/index.css`, keeping component styling independent of individual theme colors.

## Typography
- Display and section headings: Manrope, weights 600-800.
- Body, controls, labels, and data: DM Sans, weights 400-700.
- Page title: 24-28px / 1.25, weight 700.
- Section title: 16-18px / 1.35, weight 700.
- Body: 14px / 1.5, weight 400.
- Dense labels and metadata: 12px / 1.4, weight 500-600.
- Use tabular numerals for amounts, times, identifiers, and measurements. Keep letter spacing at zero except short uppercase labels.

## Shape, Spacing, and Elevation
- Base spacing unit: 4px. Use 4, 8, 12, 16, 24, 32, and 40px increments.
- Controls: 6px radius; standard height 36-40px.
- Cards and repeated data panels: 8px radius.
- Dialogs: 12px radius.
- Prefer thin borders over strong shadows; reserve elevation for menus and dialogs.
- Keep data dense but separate sections with 16-24px spacing. Avoid nested cards.

## Component Rules
- Primary button: teal fill, white label, 40px target height, clear disabled state.
- Secondary button: white surface, subtle border, ink label; use coral only for destructive or high-attention actions.
- Inputs: white surface, 6px radius, 1px neutral border, visible teal focus ring; labels remain above fields.
- Cards: white surface on the canvas, subtle border, 8px corners, consistent 16px padding.
- Navigation: deep ink surface with high-contrast labels; selected item uses primary teal and a persistent active state.
- Status: preserve semantic status colors (red for critical, amber for pending/warning, green for complete); do not use brand color as a substitute for clinical status.
- Motion: short transitions for state changes only; honor `prefers-reduced-motion`.

## Implementation
Global tokens and accessibility defaults live in `src/index.css`. The application shell attaches the selected theme with `data-theme`; `src/utils/theme.ts` maps shell surfaces to semantic variables. The global header uses the same primary token. Keep new components on semantic tokens instead of introducing new one-off hex values.
