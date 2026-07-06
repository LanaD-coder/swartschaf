export const colors = {
  background: '#1A1423',
  surface: '#3D314A',
  surfaceAlt: '#2A1F33',
  primary: '#96705B',
  primaryDark: '#7A5A48',
  success: '#5DB88A',
  warning: '#C9956A',
  danger: '#C45C6A',
  text: '#FFFFFF',
  textMuted: '#AB8476',
  textLight: '#D4C4BB',
  border: '#684756',
  inputBg: '#1A1423',
  timerActive: '#5DB88A',
  timerBg: '#1E3330',
  walkin: '#684756',
  walkinBg: '#3D2535',
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
