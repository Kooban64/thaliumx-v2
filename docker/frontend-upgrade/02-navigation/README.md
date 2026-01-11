# Phase 2: Navigation & Menu Structure

## Overview

This phase implements the complete navigation and menu structure as specified in `PLATFORM_FEATURES_AND_MENU_STRUCTURE.md`. The navigation system must be role-aware, KYC-level aware, and provide seamless navigation across all dashboards.

## Objectives

1. Implement complete menu structure for all dashboards
2. Create role-based navigation components
3. Implement breadcrumb navigation
4. Create mobile-responsive navigation
5. Implement navigation state management
6. Add navigation analytics tracking

## Menu Structure Requirements

### Platform Admin Dashboard (`/admin`)

Complete menu tree as specified in the documentation:
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

### Broker Admin Dashboard (`/broker`)

Complete menu tree as specified:
- Home
- User Management
- Trading Operations
- Financial Management
- Compliance
- Broker Settings
- Analytics

### End User Dashboard (`/dashboard`)

Complete menu tree as specified:
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

## Implementation Requirements

### 1. Navigation Components

#### Main Navigation Components
- `MainNav` - Primary navigation component
- `SidebarNav` - Sidebar navigation
- `TopNav` - Top navigation bar
- `MobileNav` - Mobile navigation drawer
- `Breadcrumbs` - Breadcrumb navigation
- `NavItem` - Individual navigation item
- `NavGroup` - Navigation group/category

#### Features
- Role-based menu visibility
- KYC level-based feature visibility
- Permission-based menu items
- Active route highlighting
- Collapsible menu groups
- Icon support for menu items
- Badge/notification support
- Search functionality (for admin)

### 2. Menu Configuration

#### Menu Data Structure
```typescript
interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ComponentType;
  badge?: string | number;
  children?: NavItem[];
  roles?: string[];
  kycLevels?: string[];
  permissions?: string[];
  featureFlag?: string;
}
```

#### Menu Configuration Files
- `config/nav/admin-nav.ts` - Admin navigation config
- `config/nav/broker-nav.ts` - Broker navigation config
- `config/nav/user-nav.ts` - User navigation config

### 3. Role-Based Menu Filtering

#### Filtering Logic
- Filter menu items based on user role
- Filter menu items based on KYC level
- Filter menu items based on permissions
- Filter menu items based on feature flags
- Show/hide entire menu sections

#### Implementation
```typescript
// lib/navigation/filter.ts
export function filterNavItems(
  items: NavItem[],
  userRole: string,
  kycLevel: string,
  permissions: string[]
): NavItem[] {
  // Filter logic
}
```

### 4. Navigation State Management

#### State Requirements
- Current active route
- Sidebar open/closed state
- Mobile menu open/closed state
- Navigation history
- Breadcrumb trail

#### Implementation
- Use Zustand store (`uiStore`)
- Persist sidebar state
- Track navigation history

### 5. Mobile Navigation

#### Requirements
- Responsive design (mobile-first)
- Hamburger menu
- Slide-out drawer
- Touch-friendly
- Gesture support (swipe to close)

### 6. Breadcrumb Navigation

#### Features
- Automatic breadcrumb generation from route
- Manual breadcrumb override
- Clickable breadcrumb items
- Current page indicator

### 7. Navigation Analytics

#### Tracking
- Page views
- Navigation patterns
- Menu item clicks
- Time spent on pages
- Navigation errors

## Component Structure

```
components/navigation/
├── MainNav.tsx
├── SidebarNav.tsx
├── TopNav.tsx
├── MobileNav.tsx
├── Breadcrumbs.tsx
├── NavItem.tsx
├── NavGroup.tsx
└── hooks/
    ├── useNavigation.ts
    ├── useActiveRoute.ts
    └── useMenuFilter.ts
```

## Configuration Files

```
config/nav/
├── admin-nav.ts
├── broker-nav.ts
├── user-nav.ts
└── types.ts
```

## Implementation Details

### Menu Item Rendering

Each menu item should:
1. Check role permissions
2. Check KYC level requirements
3. Check feature flags
4. Show active state
5. Handle click events
6. Support nested menus

### Active Route Detection

- Use Next.js `usePathname()` hook
- Match current path with menu item href
- Handle nested routes
- Handle query parameters

### Navigation Guards

- Check authentication before navigation
- Check role permissions
- Check KYC level requirements
- Show upgrade prompts when needed

## Success Criteria

1. ✅ All menu structures match documentation
2. ✅ Role-based filtering works correctly
3. ✅ KYC level filtering works correctly
4. ✅ Mobile navigation is fully functional
5. ✅ Breadcrumbs work on all pages
6. ✅ Navigation state persists correctly
7. ✅ Active route highlighting works
8. ✅ Navigation analytics are tracked

## Next Steps

After completing Phase 2, proceed to:
- Phase 3: KYC System (uses navigation for KYC pages)
- Phase 4: Role-Based Access (uses navigation filtering)
- Phase 5: Trading (uses navigation for trading pages)
