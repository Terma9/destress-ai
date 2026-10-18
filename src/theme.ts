/**
 * Destress AI design tokens.
 * Colors, gradients, spacing, radii and typography derived from the report mockups
 * (soft blue/mint backgrounds, blue + purple accents, gradient metric cards).
 */

export const colors = {
  // Brand
  primary: '#2563EB', // blue
  primaryDark: '#1D4ED8',
  purple: '#7C3AED',
  purpleLight: '#A855F7',
  green: '#10B981',

  // Surfaces
  bg: '#F5F8FC', // app background base (gradient sits on top)
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',

  // Text
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',

  // Lines / misc
  border: '#E7EDF5',
  white: '#FFFFFF',
  star: '#F59E0B',
  danger: '#EF4444',
} as const;

/** Linear-gradient color stops (2-stop) used across the app. */
export const gradients = {
  appBackground: ['#EAF2FF', '#EAF7F1'] as [string, string], // blue → mint
  primary: ['#3B82F6', '#2563EB'] as [string, string],
  insight: ['#3B82F6', '#4F46E5'] as [string, string], // Home "Today's Insight"
  aiAnalysis: ['#8B5CF6', '#6366F1'] as [string, string], // Diary AI card
  stress: ['#F97316', '#EC4899'] as [string, string], // orange → pink
  emotion: ['#06B6D4', '#3B82F6'] as [string, string], // cyan → blue
  sleep: ['#8B5CF6', '#6366F1'] as [string, string], // purple → indigo
  community: ['#8B5CF6', '#D946EF'] as [string, string], // purple → magenta
  featured: ['#7C3AED', '#9333EA'] as [string, string],
  quickRelief: ['#8B5CF6', '#6366F1'] as [string, string],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#1E293B',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#1E293B',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export const font = {
  h1: { fontSize: 26, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  title: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '400' as const },
} as const;
