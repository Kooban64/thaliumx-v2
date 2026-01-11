/**
 * Design Tokens - Cursor IDE-Inspired Theme
 * 
 * Design tokens for the ThaliumX platform with Cursor IDE aesthetic
 */

export const designTokens = {
  // Border Radius (rounded corners)
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },

  // Spacing Scale
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 2px 8px rgba(0, 0, 0, 0.1)',
    lg: '0 4px 16px rgba(0, 0, 0, 0.15)',
    dark: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
      md: '0 2px 8px rgba(0, 0, 0, 0.3)',
      lg: '0 4px 16px rgba(0, 0, 0, 0.4)',
    },
  },

  // Border Widths
  borders: {
    thin: '1px',
    medium: '2px',
    thick: '3px',
  },
};

export const darkTheme = {
  name: 'dark',
  colors: {
    // Backgrounds
    background: '#1e1e1e',
    surface: '#252526',
    surfaceHover: '#2d2d30',
    surfaceActive: '#3e3e42',
    
    // Borders
    border: '#3e3e42',
    borderHover: '#464647',
    borderActive: '#505050',
    
    // Text
    foreground: '#cccccc',
    foregroundMuted: '#858585',
    foregroundDim: '#6a6a6a',
    
    // Accent
    accent: '#007acc',
    accentHover: '#1a8cd8',
    accentActive: '#005a9e',
    
    // Status
    success: '#4ec9b0',
    warning: '#dcdcaa',
    error: '#f48771',
    info: '#4fc1ff',
    
    // Interactive
    interactive: '#0e639c',
    interactiveHover: '#1177bb',
    interactiveActive: '#094771',
  },
};

export const lightTheme = {
  name: 'light',
  colors: {
    // Backgrounds
    background: '#ffffff',
    surface: '#f3f3f3',
    surfaceHover: '#e8e8e8',
    surfaceActive: '#d4d4d4',
    
    // Borders
    border: '#e1e4e8',
    borderHover: '#d1d5da',
    borderActive: '#c6cbd1',
    
    // Text
    foreground: '#24292e',
    foregroundMuted: '#586069',
    foregroundDim: '#959da5',
    
    // Accent
    accent: '#0366d6',
    accentHover: '#0256c2',
    accentActive: '#014085',
    
    // Status
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    
    // Interactive
    interactive: '#0366d6',
    interactiveHover: '#0256c2',
    interactiveActive: '#014085',
  },
};

export type Theme = typeof darkTheme | typeof lightTheme;
