# Runway style reference (design direction for this app)

Kraft paper ledger under amber desk lamp: cream paper, espresso ink, one warm highlight color, no cold digital surfaces. Light theme only.

## Colors
| Name | Value | Role |
|---|---|---|
| Cream Canvas | #f8f7f5 | page background |
| Pure Paper | #ffffff | card surfaces, ghost button fills |
| Linen Border | #e3dfd5 | dividers, card borders, active nav fill |
| Stone Mist | #d5d2cd | subtle button borders, secondary dividers |
| Warm Ash | #aca89f | muted icon strokes |
| Driftwood | #8f897e | muted text, labels |
| Bark | #61594a | body text |
| Espresso | #261b07 | primary text, headings, icons (never #000) |
| Amber Signal | #f9a600 | ONLY filled button color, selected states |
| Burnished Gold | #e89b01 | outlined action borders, links, light emphasis |
| Terracotta | #f0624f | chart highlight, warm accent, positive deltas |
| Wisteria | #d5befa | soft badge bg (sparingly) |
| Honey Wash | #f8da9d | warm badge bg |

No blue, green, red or purple interface colors. Errors/warnings: use terracotta; success: amber/honey.

## Typography
Inter Variable (already installed via @fontsource-variable/inter) as substitute for Interphases Pro. `font-feature-settings: "ss01"`. Weights only 400 (body), 492 (emphasis, buttons), 584 (headings). Never 700+. Line-height max 1.25.
| Role | Size | LH | Tracking |
|---|---|---|---|
| caption | 12 | 1.25 | 0.6px |
| body-sm | 14 | 1.25 | -0.14px |
| body | 16 | 1.25 | -0.16px |
| subheading-sm | 20 | 1.25 | -0.22px |
| subheading | 24 | 1.13 | -0.31px |
| heading-sm | 36 | 1.13 | -0.61px |
| heading | 56 | 1.13 | -1.12px |
| display | 72 | 1.0 | -1.58px |

## Shape, spacing, elevation
- Radius 8px for cards, buttons, inputs, nav; 4px for badges. No full pills except status dots.
- Compact density. Max width 1200px. Section gap 56-80px, card padding 24-32px, element gap 8-16px.
- Card shadow: `0 4px 8px rgba(38,27,7,0.06)`. Primary CTA shadow: `inset 0 2px 4px rgba(255,255,255,0.56), 0 4px 8px rgba(38,27,7,0.06), 0 1px 2px rgba(38,27,7,0.36)`. Never cool gray shadows.
- Layering: Cream Canvas -> Pure Paper card (1px Linen border) -> elevated white with shadow. Separate with Linen borders and whitespace, never colored background bands.

## Components
- Amber CTA: bg #f9a600, Espresso text, 8px radius, 8px 16px padding, 16px weight 492, CTA shadow.
- Ghost button: transparent, 1px Espresso border, Espresso text, same radius/padding.
- Header: wordmark left 20px/584, nav 14px/400, amber small CTA far right (6px 12px, 14px/492), 1px Linen bottom border.
- Dashboard card: white, 1px Linen, 8px radius, 24-32px padding, card shadow.
- Metric tile: label 12px Driftwood, value 20-24px weight 584 Espresso, delta 12px/492 Terracotta.
- Badge: 4px radius, 4px 8px padding, 12px/492; Honey Wash or Wisteria bg with Espresso text, or Linen bg with Bark text.
- Inputs: 8px radius, 1px Linen border, placeholder Driftwood.
- Icons: Espresso (Phosphor duotone in this app).
