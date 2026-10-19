/**
 * Destress AI design tokens: "soft color fields".
 *
 * Three muted color fields carry meaning across the app: stress = clay,
 * sleep = indigo, mood = sage. Warm ivory background, deep ink for primary
 * actions, DM Sans. Older keys (primary, purple, gradients.insight, …) are
 * kept and point at the new palette, so every screen picks up the new look.
 * The previous design is saved as the git tag `design-v1`.
 */

/** Color fields for the three tracked values. `from`/`to` are the soft gradient. */
export const fields = {
  stress: { from: '#F6E6DC', to: '#EBC7B2', ink: '#7A3E25', strong: '#D99272', deep: '#A9532F' },
  sleep: { from: '#E4E8F7', to: '#C8D0EE', ink: '#2E3A66', strong: '#7F8CC4', deep: '#4A578F' },
  mood: { from: '#E4EEDF', to: '#C5DABD', ink: '#2F4F2E', strong: '#86A97C', deep: '#557A4C' },
} as const;

export type FieldKey = keyof typeof fields;

export const colors = {
  // Core
  ivory: '#FBFAF7',
  ink: '#1C1B19',
  inkSoft: '#4A4740',
  sand: '#F2EEE7',
  clay: '#C9663F',

  // Legacy names, mapped onto the new palette
  primary: '#1C1B19',
  primaryDark: '#000000',
  purple: '#C9663F', // the accent is now clay
  purpleLight: '#D99272',
  green: '#6F9764',

  // Surfaces
  bg: '#FBFAF7',
  card: '#FFFFFF',
  cardAlt: '#F6F4EF',

  // Text
  text: '#1C1B19',
  textMuted: '#77736B',
  textFaint: '#A8A39A',

  // Lines / misc
  border: '#ECE8E1',
  white: '#FFFFFF',
  star: '#E8A55B',
  danger: '#C2412D',
} as const;

/** Linear-gradient color stops (2-stop) used across the app. */
export const gradients = {
  appBackground: ['#FBFAF7', '#FBFAF7'] as [string, string],
  /** Primary actions: deep ink with a hint of warmth. */
  primary: ['#2B2925', '#151412'] as [string, string],
  /** Mic, Untangle accents. */
  clay: ['#E59A78', '#C9663F'] as [string, string],
  untangle: ['#F3D5C4', '#E8B39A'] as [string, string],
  // Strong gradients that carry white text (legacy cards)
  insight: ['#6B77B5', '#3F4A85'] as [string, string],
  aiAnalysis: ['#6B77B5', '#3F4A85'] as [string, string],
  stress: ['#D99272', '#A9532F'] as [string, string],
  emotion: ['#86A97C', '#557A4C'] as [string, string],
  sleep: ['#7F8CC4', '#4A578F'] as [string, string],
  community: ['#86A97C', '#557A4C'] as [string, string],
  featured: ['#D99272', '#A9532F'] as [string, string],
  quickRelief: ['#7F8CC4', '#4A578F'] as [string, string],
} as const;

/** Soft background tints at the top of a screen, one per area. */
export const tints = {
  clay: '#FBEDE3',
  indigo: '#E9ECFA',
  sage: '#E8F1E3',
} as const;

export type Tint = keyof typeof tints;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Layered shadows: a tight contact shadow plus a wide soft one. */
export const shadow = {
  card: { boxShadow: '0px 1px 2px rgba(28, 27, 25, 0.04), 0px 10px 28px rgba(28, 27, 25, 0.07)' },
  soft: { boxShadow: '0px 1px 2px rgba(28, 27, 25, 0.04), 0px 4px 14px rgba(28, 27, 25, 0.05)' },
  lifted: { boxShadow: '0px 2px 4px rgba(28, 27, 25, 0.06), 0px 18px 40px rgba(28, 27, 25, 0.16)' },
} as const;

/** DM Sans, loaded in the root layout. Use the family for the weight (no fontWeight with custom fonts). */
export const fontFamily = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const;

export const font = {
  display: { fontFamily: fontFamily.bold, fontSize: 30, letterSpacing: -0.8, lineHeight: 33 },
  h1: { fontFamily: fontFamily.bold, fontSize: 27, letterSpacing: -0.6 },
  h2: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.4 },
  h3: { fontFamily: fontFamily.bold, fontSize: 19, letterSpacing: -0.3 },
  title: { fontFamily: fontFamily.semibold, fontSize: 16, letterSpacing: -0.1 },
  body: { fontFamily: fontFamily.regular, fontSize: 14 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 14 },
  small: { fontFamily: fontFamily.regular, fontSize: 12 },
  label: { fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 0.4 },
  tiny: { fontFamily: fontFamily.regular, fontSize: 11 },
} as const;
