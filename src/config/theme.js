// Modern Theme Configuration for Switchly
// Enhanced color palette with gradients and modern design tokens

export const Colors = {
  // Primary Colors
  primary: '#4361EE',
  primaryDark: '#3F37C9',
  primaryLight: '#5E7CE8',
  
  // Gradient Colors
  gradientStart: '#4361EE',
  gradientMiddle: '#6C5CE7',
  gradientEnd: '#A29BFE',
  
  // Accent Colors
  accent: '#4CC9F0',
  accentDark: '#00C9FF',
  
  // Status Colors
  success: '#4CAF50',
  successLight: '#66BB6A',
  warning: '#FF9800',
  warningLight: '#FFB74D',
  danger: '#F44336',
  dangerLight: '#EF5350',
  info: '#2196F3',
  
  // Neutral Colors
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#F5F5F5',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#9E9E9E',
  border: '#E0E0E0',
  divider: '#F0F0F0',
  
  // Glassmorphism
  glassBackground: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.18)',
  
  // Shadows
  shadowColor: '#000000',
}

// Gradient Presets
export const Gradients = {
  primary: ['#4361EE', '#6C5CE7', '#A29BFE'],
  primaryDark: ['#3F37C9', '#5E7CE7', '#8B7BFE'],
  success: ['#4CAF50', '#66BB6A'],
  warning: ['#FF9800', '#FFB74D'],
  danger: ['#F44336', '#EF5350'],
  hero: ['#4361EE', '#6C5CE7', '#A29BFE', '#3F37C9'],
  card: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)'],
}

// Spacing Scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// Border Radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
}

// Shadow Presets
export const Shadows = {
  sm: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
}

// Typography Scale
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  overline: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
}

// Animation Durations
export const AnimationDurations = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 800,
}

// Common Styles (Note: Spread operators should be flattened in StyleSheet.create)
export const CommonStyles = {
  glassCard: {
    backgroundColor: Gradients.card[0],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: Shadows.md.shadowColor,
    shadowOffset: Shadows.md.shadowOffset,
    shadowOpacity: Shadows.md.shadowOpacity,
    shadowRadius: Shadows.md.shadowRadius,
    elevation: Shadows.md.elevation,
  },
  gradientCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Shadows.lg.shadowColor,
    shadowOffset: Shadows.lg.shadowOffset,
    shadowOpacity: Shadows.lg.shadowOpacity,
    shadowRadius: Shadows.lg.shadowRadius,
    elevation: Shadows.lg.elevation,
  },
  shadowCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    shadowColor: Shadows.md.shadowColor,
    shadowOffset: Shadows.md.shadowOffset,
    shadowOpacity: Shadows.md.shadowOpacity,
    shadowRadius: Shadows.md.shadowRadius,
    elevation: Shadows.md.elevation,
  },
}

export default {
  Colors,
  Gradients,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
  AnimationDurations,
  CommonStyles,
}

