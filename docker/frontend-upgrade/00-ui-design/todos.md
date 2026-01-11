# Phase 0: Cursor IDE-Inspired UI/UX Design - Todos

## Frame Design

- [ ] Create `AppFrame` component
  - [ ] Rounded corners (6-8px)
  - [ ] Border styling
  - [ ] Shadow implementation
  - [ ] Responsive width
  - [ ] Background styling
  - [ ] Container max-width
  - [ ] Centered positioning
- [ ] Apply frame to root layout
- [ ] Test frame on all screen sizes
- [ ] Adjust frame styling for perfection

## Header Design

- [ ] Create `AppHeader` component
  - [ ] Sticky positioning
  - [ ] Height (48-56px)
  - [ ] Background styling
  - [ ] Border bottom
  - [ ] Responsive design
- [ ] Create `HeaderLogo` component
  - [ ] Logo display
  - [ ] Clickable to home
  - [ ] Branding text
- [ ] Create `HeaderNav` component
  - [ ] Horizontal menu layout
  - [ ] All menu items
  - [ ] Active route highlighting
  - [ ] Dropdown menus for nested items
  - [ ] Icons for menu items
  - [ ] Badge indicators
  - [ ] Responsive collapse
- [ ] Create `HeaderUserMenu` component
  - [ ] User profile display
  - [ ] Dropdown menu
  - [ ] User actions
  - [ ] Notifications
- [ ] Create `ThemeToggle` component
  - [ ] Theme switcher button
  - [ ] Icon (sun/moon)
  - [ ] Smooth transition
- [ ] Create `HeaderSettings` component
  - [ ] Settings access
  - [ ] Quick settings menu
- [ ] Integrate header into layout
- [ ] Test header on all screen sizes
- [ ] Test header with all menu items

## Footer Design

- [ ] Create `AppFooter` component
  - [ ] Footer layout
  - [ ] Height (48-64px)
  - [ ] Background styling
  - [ ] Border top
  - [ ] Responsive design
- [ ] Create `FooterLinks` component
  - [ ] Quick links section
  - [ ] Support link
  - [ ] Documentation link
  - [ ] Privacy link
  - [ ] Terms link
- [ ] Create `FooterInfo` component
  - [ ] System information
  - [ ] API status
  - [ ] System health
  - [ ] Last sync time
  - [ ] Version information
- [ ] Create `FooterStatus` component
  - [ ] Connection status indicator
  - [ ] Sync status indicator
  - [ ] Notification count
  - [ ] Status colors
- [ ] Integrate footer into layout
- [ ] Test footer on all screen sizes
- [ ] Populate footer with real data

## Theme System

- [ ] Create theme tokens file
  - [ ] Dark theme colors
  - [ ] Light theme colors
  - [ ] Spacing tokens
  - [ ] Typography tokens
  - [ ] Border tokens
  - [ ] Shadow tokens
- [ ] Create `ThemeProvider` component
  - [ ] Theme context
  - [ ] Theme state management
  - [ ] Theme persistence (localStorage)
  - [ ] System preference detection
- [ ] Create `useTheme` hook
  - [ ] Theme getter
  - [ ] Theme setter
  - [ ] Theme toggle
- [ ] Update CSS variables for theming
  - [ ] Dark theme variables
  - [ ] Light theme variables
  - [ ] Smooth transitions
- [ ] Integrate theme provider into app
- [ ] Test theme switching
- [ ] Test theme persistence
- [ ] Test system preference detection

## Design Tokens

- [ ] Define color palette
  - [ ] Dark theme colors
  - [ ] Light theme colors
  - [ ] Accent colors
  - [ ] Status colors
- [ ] Define spacing scale
  - [ ] Consistent spacing values
  - [ ] Padding/margin scale
- [ ] Define typography scale
  - [ ] Font families
  - [ ] Font sizes
  - [ ] Font weights
  - [ ] Line heights
- [ ] Define border tokens
  - [ ] Border radius values
  - [ ] Border widths
- [ ] Define shadow tokens
  - [ ] Shadow values
  - [ ] Depth levels
- [ ] Create design tokens file
- [ ] Apply tokens throughout app

## Navigation Menu Implementation

- [ ] Create header menu for User Dashboard
  - [ ] All user menu items
  - [ ] Active state
  - [ ] Icons
  - [ ] Dropdowns
- [ ] Create header menu for Admin Dashboard
  - [ ] All admin menu items
  - [ ] Active state
  - [ ] Icons
  - [ ] Dropdowns
- [ ] Create header menu for Broker Dashboard
  - [ ] All broker menu items
  - [ ] Active state
  - [ ] Icons
  - [ ] Dropdowns
- [ ] Implement role-based menu filtering
- [ ] Implement KYC level-based filtering
- [ ] Implement active route highlighting
- [ ] Implement dropdown menus
- [ ] Implement badge indicators

## Responsive Design

- [ ] Design mobile header
  - [ ] Hamburger menu
  - [ ] Collapsed navigation
  - [ ] Mobile menu drawer
- [ ] Design mobile footer
  - [ ] Stacked layout
  - [ ] Reduced information
- [ ] Design tablet layout
  - [ ] Adapted header
  - [ ] Adapted footer
- [ ] Test all breakpoints
- [ ] Test touch interactions
- [ ] Test mobile menu

## Layout Integration

- [ ] Update root layout (`app/layout.tsx`)
  - [ ] Wrap with AppFrame
  - [ ] Add AppHeader
  - [ ] Add AppFooter
  - [ ] Remove old header/footer
- [ ] Update all page layouts
  - [ ] Remove duplicate headers
  - [ ] Remove duplicate footers
  - [ ] Ensure consistent layout
- [ ] Test layout on all pages
- [ ] Fix any layout issues

## Styling & Polish

- [ ] Apply consistent spacing
- [ ] Apply consistent typography
- [ ] Apply consistent colors
- [ ] Add subtle animations
  - [ ] Theme transition
  - [ ] Menu hover effects
  - [ ] Button interactions
- [ ] Polish all components
- [ ] Ensure accessibility
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] Focus indicators
- [ ] Test in both themes
- [ ] Test on all devices

## Testing

- [ ] Test frame design
- [ ] Test header functionality
- [ ] Test footer functionality
- [ ] Test theme switching
- [ ] Test responsive design
- [ ] Test navigation menu
- [ ] Test all breakpoints
- [ ] Test accessibility
- [ ] Test performance

## Documentation

- [ ] Document design system
- [ ] Document theme system
- [ ] Document component usage
- [ ] Document design tokens
- [ ] Create design guide
- [ ] Create component examples
