// Palette: "Night Bordeaux → Sandy Brown" — a dark, warm bordeaux-to-coral brand identity.
// The five named colors below are used directly; every other token is a derived shade
// (darken/lighten within the same warm family) needed for structural UI depth
// (panels, borders, pressed states) that a 5-color palette doesn't cover on its own.
// `success` is the one deliberate exception — kept as the original green, since a
// positive/complete state benefits from staying visually distinct from the
// red/orange danger-warning family. Flag it if you'd rather it match the palette too.
export const colors = {
  background: '#4f000b',   // Night Bordeaux
  surfaceAlt: '#38010f',   // derived — between background and surface
  surface: '#720026',      // Dark Amaranth
  primary: '#ce4257',      // Amaranth
  primaryDark: '#a53249',  // derived — darker Amaranth, pressed/active states
  success: '#5DB88A',      // unchanged — functional positive-state green
  warning: '#ff7f51',      // Coral Glow
  danger: '#9c1436',       // derived — deep red, distinct from primary and surface
  text: '#FFFFFF',
  textMuted: '#d99aa0',    // derived — warm muted rose
  textLight: '#ffcdbb',    // derived — warm light neutral
  border: '#5c2530',       // derived — muted dark rose
  inputBg: '#4f000b',      // = background
  timerActive: '#ff9b54',  // Sandy Brown
  timerBg: '#3a1206',      // derived — dark warm backdrop for the active-timer badge
  walkin: '#ff7f51',       // Coral Glow
  walkinBg: '#3a0009',     // derived — dark backdrop for the walk-in badge
};

export const typography = {
  heading: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.textLight,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
};
