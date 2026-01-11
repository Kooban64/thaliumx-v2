# Phase 0: Cursor IDE-Inspired UI/UX Design

## Overview

This phase establishes the complete visual design system inspired by Cursor IDE, creating a framed application with rounded edges, comprehensive header and footer, and full dark/light theme support. This design will be the foundation for the entire platform.

## Objectives

1. Create Cursor IDE-inspired frame design
2. Implement comprehensive header with all menu items
3. Implement meaningful footer
4. Implement dark/light theme system
5. Create consistent design tokens
6. Establish component styling patterns

## Design Requirements

### Visual Style

#### Frame Design
- **Framed Application**: Application content is contained within a frame
- **Rounded Corners**: Subtle rounding on all edges (border-radius: 6-8px)
- **Border**: Subtle border around the frame
- **Shadow**: Subtle shadow for depth
- **Background**: Clean, minimal background

#### Color Scheme
- **Dark Theme**: Primary theme (like Cursor dark mode)
- **Light Theme**: Alternative theme
- **Accent Colors**: Subtle, professional accents
- **Contrast**: High contrast for readability

### Header Design

#### Header Structure
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] [Menu Items]                    [User] [Theme] [Settings] │
└─────────────────────────────────────────────────────────────┘
```

#### Header Components
- **Logo/Branding**: Left side, clickable to home
- **Navigation Menu**: All menu items in header (horizontal)
  - Role-based menu items
  - KYC level-based items
  - Active route highlighting
- **User Menu**: User profile, notifications, account
- **Theme Toggle**: Dark/light mode switcher
- **Settings**: Quick settings access

#### Header Features
- Sticky header (stays at top on scroll)
- Responsive design (collapses on mobile)
- Active route indicator
- Dropdown menus for nested items
- Badge/notification indicators

### Footer Design

#### Footer Structure
```
┌─────────────────────────────────────────────────────────────┐
│ [Links] [Info] [Status] [Version]                           │
└─────────────────────────────────────────────────────────────┘
```

#### Footer Components
- **Quick Links**: Important links (Support, Docs, Privacy, Terms)
- **System Information**: 
  - API status
  - System health
  - Last sync time
- **Version Information**: App version, build info
- **Status Indicators**: 
  - Connection status
  - Sync status
  - Notification count

### Layout Structure

#### Application Frame
```
┌─────────────────────────────────────────┐
│              HEADER                     │
├─────────────────────────────────────────┤
│                                         │
│              CONTENT                    │
│         (with padding)                  │
│                                         │
├─────────────────────────────────────────┤
│              FOOTER                     │
└─────────────────────────────────────────┘
```

#### Frame Styling
- Container with max-width
- Centered on page
- Rounded corners (6-8px)
- Subtle border
- Shadow for depth
- Responsive padding

## Implementation Requirements

### 1. Frame Component

#### Features
- Rounded corners
- Border styling
- Shadow
- Responsive width
- Background

#### Component
- `AppFrame` - Main application frame wrapper

### 2. Header Component

#### Features
- Sticky positioning
- Logo/branding
- Navigation menu (all items)
- User menu
- Theme toggle
- Settings access
- Responsive design

#### Components
- `AppHeader` - Main header component
- `HeaderLogo` - Logo/branding
- `HeaderNav` - Navigation menu
- `HeaderUserMenu` - User menu dropdown
- `ThemeToggle` - Theme switcher
- `HeaderSettings` - Settings access

### 3. Footer Component

#### Features
- Fixed or sticky footer
- Quick links
- System information
- Status indicators
- Version info

#### Components
- `AppFooter` - Main footer component
- `FooterLinks` - Quick links section
- `FooterInfo` - System information
- `FooterStatus` - Status indicators

### 4. Theme System

#### Features
- Dark theme (default)
- Light theme
- Theme persistence
- Smooth transitions
- System preference detection

#### Implementation
- CSS variables for theming
- Theme provider
- Theme toggle component
- Theme persistence (localStorage)

### 5. Design Tokens

#### Color Tokens
- Background colors
- Foreground colors
- Border colors
- Accent colors
- Status colors

#### Spacing Tokens
- Consistent spacing scale
- Padding/margin values

#### Typography Tokens
- Font families
- Font sizes
- Font weights
- Line heights

#### Border Tokens
- Border radius values
- Border widths
- Border styles

#### Shadow Tokens
- Shadow values for depth

## Component Structure

```
components/layout/
├── AppFrame.tsx          # Main application frame
├── AppHeader.tsx         # Header component
│   ├── HeaderLogo.tsx
│   ├── HeaderNav.tsx
│   ├── HeaderUserMenu.tsx
│   ├── ThemeToggle.tsx
│   └── HeaderSettings.tsx
├── AppFooter.tsx         # Footer component
│   ├── FooterLinks.tsx
│   ├── FooterInfo.tsx
│   └── FooterStatus.tsx
└── theme/
    ├── ThemeProvider.tsx
    ├── useTheme.ts
    └── theme-tokens.ts
```

## Design Specifications

### Frame Specifications
- **Border Radius**: 6-8px
- **Border**: 1px solid, subtle color
- **Shadow**: `0 2px 8px rgba(0, 0, 0, 0.1)` (light) / `0 2px 8px rgba(0, 0, 0, 0.3)` (dark)
- **Max Width**: 100% (responsive)
- **Padding**: 0 (content has padding)

### Header Specifications
- **Height**: 48-56px
- **Background**: Slightly different from frame
- **Border Bottom**: 1px solid
- **Padding**: Horizontal 16-24px
- **Sticky**: Yes, stays at top

### Footer Specifications
- **Height**: 48-64px
- **Background**: Slightly different from frame
- **Border Top**: 1px solid
- **Padding**: Horizontal 16-24px
- **Font Size**: Smaller (12-14px)

### Color Palette

#### Dark Theme (Primary)
- Background: `#1e1e1e` or similar
- Surface: `#252526`
- Border: `#3e3e42`
- Text: `#cccccc`
- Accent: `#007acc` (blue)

#### Light Theme
- Background: `#ffffff`
- Surface: `#f3f3f3`
- Border: `#e1e4e8`
- Text: `#24292e`
- Accent: `#0366d6` (blue)

## Navigation Menu in Header

### Menu Structure
All menu items from the platform documentation should be accessible from the header:

#### User Dashboard Header Menu
- Home
- Trading
- Wallet
- Portfolio
- Presale & Token Sales
- Staking
- NFT Marketplace
- DEX
- Market Data
- Account
- Support

#### Admin Dashboard Header Menu
- Home
- System Management
- User Management
- Broker Management
- RBAC & Permissions
- Policy Management
- Workflow Management
- Compliance & Audit
- Financial Management
- Security & Risk
- Analytics & Reporting
- Limit Management

#### Broker Dashboard Header Menu
- Home
- User Management
- Trading Operations
- Financial Management
- Compliance
- Broker Settings
- Analytics

### Menu Features
- Dropdown menus for nested items
- Active route highlighting
- Icons for menu items
- Badge indicators (notifications, etc.)
- Responsive collapse on mobile

## Implementation Details

### Layout Integration

#### Root Layout
```tsx
<AppFrame>
  <AppHeader />
  <main>{children}</main>
  <AppFooter />
</AppFrame>
```

### Theme Integration

#### Theme Provider
- Wrap application with ThemeProvider
- Provide theme context
- Handle theme switching
- Persist theme preference

### Responsive Design

#### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

#### Mobile Behavior
- Header collapses to hamburger menu
- Footer stacks vertically
- Frame remains but adapts

## Success Criteria

1. ✅ Application has Cursor-like frame design
2. ✅ Header contains all menu items
3. ✅ Footer has meaningful information
4. ✅ Dark/light themes work perfectly
5. ✅ Design is consistent across all pages
6. ✅ Responsive design works on all devices
7. ✅ Theme persistence works
8. ✅ All components follow design system

## Next Steps

After completing Phase 0, proceed to:
- Phase 1: Foundation (builds on this design system)
- Phase 2: Navigation (uses header menu structure)

## Design Reference

The design should match Cursor IDE's aesthetic:
- Clean, minimal interface
- Professional appearance
- Excellent readability
- Smooth interactions
- Consistent spacing
- Subtle animations
