# Phase 2: Navigation & Menu Structure - Todos

## Menu Configuration

- [ ] Create menu configuration types (`config/nav/types.ts`)
- [ ] Create admin navigation config (`config/nav/admin-nav.ts`)
  - [ ] Home section
  - [ ] System Management section
  - [ ] User Management section
  - [ ] Broker Management section
  - [ ] RBAC & Permissions section
  - [ ] Policy Management section
  - [ ] Workflow Management section
  - [ ] Compliance & Audit section
  - [ ] Financial Management section
  - [ ] Security & Risk section
  - [ ] Analytics & Reporting section
- [ ] Create broker navigation config (`config/nav/broker-nav.ts`)
  - [ ] Home section
  - [ ] User Management section
  - [ ] Trading Operations section
  - [ ] Financial Management section
  - [ ] Compliance section
  - [ ] Broker Settings section
  - [ ] Analytics section
- [ ] Create user navigation config (`config/nav/user-nav.ts`)
  - [ ] Home section
  - [ ] Trading section
  - [ ] Wallet section
  - [ ] Portfolio section
  - [ ] Presale & Token Sales section
  - [ ] Staking section
  - [ ] NFT Marketplace section
  - [ ] DEX section
  - [ ] Market Data section
  - [ ] Account section
  - [ ] Support section

## Navigation Components

### Core Components
- [ ] Create `MainNav` component
- [ ] Create `SidebarNav` component
  - [ ] Desktop sidebar
  - [ ] Collapsible groups
  - [ ] Active state highlighting
  - [ ] Icon support
  - [ ] Badge support
- [ ] Create `TopNav` component
  - [ ] User menu
  - [ ] Notifications
  - [ ] Search (admin)
- [ ] Create `MobileNav` component
  - [ ] Hamburger menu
  - [ ] Slide-out drawer
  - [ ] Touch gestures
- [ ] Create `Breadcrumbs` component
  - [ ] Automatic generation
  - [ ] Manual override
  - [ ] Clickable items
- [ ] Create `NavItem` component
  - [ ] Link rendering
  - [ ] Active state
  - [ ] Icon rendering
  - [ ] Badge rendering
  - [ ] Nested menu support
- [ ] Create `NavGroup` component
  - [ ] Collapsible groups
  - [ ] Group icons
  - [ ] Group badges

## Navigation Logic

- [ ] Create `useNavigation` hook
- [ ] Create `useActiveRoute` hook
- [ ] Create `useMenuFilter` hook
- [ ] Implement role-based filtering
- [ ] Implement KYC level filtering
- [ ] Implement permission-based filtering
- [ ] Implement feature flag filtering
- [ ] Create navigation guard utilities

## Layout Integration

- [ ] Integrate navigation into `AdminLayout`
- [ ] Integrate navigation into `BrokerLayout`
- [ ] Integrate navigation into `DashboardLayout`
- [ ] Add navigation state to `uiStore`
- [ ] Implement sidebar toggle
- [ ] Implement mobile menu toggle
- [ ] Add navigation persistence

## Route Configuration

- [ ] Create route constants for all pages
- [ ] Map routes to menu items
- [ ] Handle nested routes
- [ ] Handle query parameters
- [ ] Create route helpers

## Navigation Features

- [ ] Implement search functionality (admin)
- [ ] Implement notification badges
- [ ] Implement menu item badges
- [ ] Add keyboard navigation support
- [ ] Add accessibility attributes
- [ ] Implement focus management

## Mobile Responsiveness

- [ ] Test mobile navigation
- [ ] Test tablet navigation
- [ ] Test desktop navigation
- [ ] Implement responsive breakpoints
- [ ] Test touch gestures
- [ ] Test swipe to close

## Navigation Analytics

- [ ] Set up navigation tracking
- [ ] Track page views
- [ ] Track menu clicks
- [ ] Track navigation patterns
- [ ] Track navigation errors

## Testing

- [ ] Test role-based filtering
- [ ] Test KYC level filtering
- [ ] Test permission-based filtering
- [ ] Test active route detection
- [ ] Test mobile navigation
- [ ] Test breadcrumb generation
- [ ] Test navigation guards

## Documentation

- [ ] Document menu configuration
- [ ] Document navigation components
- [ ] Document filtering logic
- [ ] Document navigation hooks
- [ ] Create navigation guide
