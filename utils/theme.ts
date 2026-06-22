export const colors = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceAlt: '#16213e',
  primary: '#e94560',
  primaryDark: '#c73652',
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  text: '#f0f0f0',
  textMuted: '#8888aa',
  textLight: '#ccccdd',
  border: '#2a2a4a',
  inputBg: '#0f0f1a',
  timerActive: '#2ecc71',
  timerBg: '#1a3a2a',
  walkin: '#9b59b6',
  walkinBg: '#2a1a3a',
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
