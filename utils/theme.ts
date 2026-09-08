// Palette: "Night Bordeaux → Sandy Brown" — a warm bordeaux-to-coral brand identity,
// used as ACCENTS on a white/off-white base (flipped from an earlier all-dark version
// that read as too red overall). Background/surface/text are now a light neutral scale;
// primary/warning/timerActive/walkin still come straight from the named palette colors.
// `success` stays a distinct green (not in the palette) so a positive/complete state
// reads as positive, not just "another warm accent."
export const colors = {
  background: "#FBF7F6", // near-white, warm-tinted page background
  surfaceAlt: "#F5EBE9", // light tinted panel — between background and a plain white card
  surface: "#FFFFFF", // card background — pops against the off-white page
  primary: "#ce4257", // Amaranth — main accent/action color
  primaryDark: "#a53249", // derived — darker Amaranth, pressed/active states
  success: "#2f8f63", // darkened green — legible on white, stays distinct from the warm family
  warning: "#e8703f", // Coral Glow, darkened slightly for text/icon contrast on white
  danger: "#c62839", // derived — deep red, legible error color on white
  text: "#241016", // near-black, warm-tinted
  textMuted: "#8a7378", // muted warm gray
  textLight: "#5c4147", // medium-dark warm gray (body text)
  border: "#e8dcdd", // light warm-gray border
  inputBg: "#F5EBE9", // light tinted input background, distinct from white cards
  timerActive: "#ff9b54", // Sandy Brown
  timerBg: "#FFE9D6", // pale Sandy Brown tint, for the active-timer badge backdrop
  walkin: "#ff7f51", // Coral Glow
  walkinBg: "#FFE3DA", // pale Coral Glow tint, for the walk-in badge backdrop
};

// Mobile-first, but the app runs in any browser — this caps content width once a
// viewport gets tablet/desktop-wide (iPad portrait is 768, landscape 1024+) so
// screens built as a single mobile-width column don't stretch into unreadably
// wide rows of text/inputs. Spread `layout.contentWidth` into a screen's outer
// content/scroll container style; it's a no-op below the cap (phones stay
// full-width as before).
export const layout = {
  maxContentWidth: 720,
  contentWidth: {
    width: '100%' as const,
    maxWidth: 720,
    alignSelf: 'center' as const,
  },
  // Narrower cap for single-form screens (login/register) — a wide dashboard
  // column reads fine at 720, but a login card that wide looks lost on a tablet.
  formWidth: {
    width: '100%' as const,
    maxWidth: 440,
    alignSelf: 'center' as const,
  },
};

export const typography = {
  heading: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: colors.text,
  },
  subheading: {
    fontSize: 16,
    fontWeight: "600" as const,
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
