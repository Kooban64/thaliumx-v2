# Phase 1: Foundation

## Overview

This phase establishes the core foundation for the frontend platform, including project structure, shared components, authentication, API client, state management, and routing.

## Objectives

1. Establish scalable project architecture
2. Create reusable component library
3. Implement robust authentication and session management
4. Set up API client with proper error handling
5. Implement state management solution
6. Create routing structure that supports role-based access

## Current State Analysis

### Existing Structure
- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS + shadcn/ui components
- Basic authentication flow (backend-auth.ts)
- API client (lib/api/client.ts)
- Basic dashboard structure

### Gaps Identified
- No centralized state management
- Limited shared component library
- No role-based routing middleware
- API client needs enhancement for error handling
- Missing session management utilities
- No centralized configuration management

## Implementation Requirements

### 1. Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login, register)
│   ├── (dashboard)/      # Protected dashboard routes
│   │   ├── dashboard/    # User dashboard
│   │   ├── admin/        # Admin dashboard
│   │   └── broker/       # Broker dashboard
│   └── api/              # API route handlers
├── components/
│   ├── ui/               # shadcn/ui base components
│   ├── shared/           # Shared reusable components
│   ├── layout/           # Layout components
│   ├── auth/             # Auth components
│   ├── trading/          # Trading components
│   ├── wallet/           # Wallet components
│   └── admin/            # Admin components
├── lib/
│   ├── api/              # API client and hooks
│   ├── auth/             # Authentication utilities
│   ├── state/            # State management
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── config/           # Configuration management
├── types/                # TypeScript type definitions
└── stores/               # State stores (Zustand/Redux)
```

### 2. Shared Component Library

#### Layout Components
- `AppLayout` - Main application layout with sidebar
- `DashboardLayout` - Dashboard-specific layout
- `AdminLayout` - Admin dashboard layout
- `BrokerLayout` - Broker dashboard layout
- `Sidebar` - Reusable sidebar component
- `Header` - Application header
- `Footer` - Application footer

#### UI Components
- `LoadingSpinner` - Loading states
- `ErrorBoundary` - Error handling
- `EmptyState` - Empty state displays
- `DataTable` - Reusable data table
- `Pagination` - Pagination controls
- `Modal` - Modal dialogs
- `Toast` - Toast notifications
- `ConfirmDialog` - Confirmation dialogs

#### Form Components
- `FormField` - Reusable form field
- `FormSelect` - Select dropdown
- `FormDatePicker` - Date picker
- `FormFileUpload` - File upload
- `FormValidation` - Form validation utilities

### 3. Authentication & Session Management

#### Features
- JWT token management
- Refresh token handling
- Session persistence
- Auto-logout on token expiry
- Role-based route protection
- Multi-tenant support

#### Implementation
- Enhance `lib/auth/backend-auth.ts`
- Create `lib/auth/session.ts` for session management
- Create `lib/auth/guards.ts` for route guards
- Create `middleware.ts` for Next.js middleware

### 4. API Client Enhancement

#### Current API Client
- Basic fetch wrapper
- Token injection
- Error handling (needs improvement)

#### Enhancements Needed
- Request/response interceptors
- Automatic token refresh
- Retry logic for failed requests
- Request cancellation
- Request queuing
- Better error types and handling
- Response caching (where appropriate)

#### Structure
```
lib/api/
├── client.ts           # Main API client
├── interceptors.ts     # Request/response interceptors
├── hooks/              # React Query hooks
│   ├── useAuth.ts
│   ├── useUser.ts
│   ├── useKYC.ts
│   └── ...
└── types.ts            # API types
```

### 5. State Management

#### Recommended: Zustand or React Query + Zustand

**React Query** for:
- Server state (API data)
- Caching
- Background updates
- Optimistic updates

**Zustand** for:
- Client state (UI state)
- Global app state
- User preferences
- Theme settings

#### Store Structure
```
stores/
├── authStore.ts        # Authentication state
├── userStore.ts        # User profile state
├── kycStore.ts         # KYC state
├── uiStore.ts          # UI state (sidebar, modals, etc.)
└── configStore.ts      # Configuration state
```

### 6. Routing Structure

#### Route Organization
- Public routes: `/`, `/login`, `/register`, `/landing`
- Protected routes: `/dashboard/*`, `/admin/*`, `/broker/*`
- API routes: `/api/*`

#### Route Guards
- `withAuth` - Requires authentication
- `withRole` - Requires specific role
- `withKYCLevel` - Requires minimum KYC level
- `withPermission` - Requires specific permission

#### Route Configuration
```typescript
// lib/routes/config.ts
export const routes = {
  public: {
    home: '/',
    login: '/login',
    register: '/register',
    landing: '/landing',
  },
  dashboard: {
    home: '/dashboard',
    trading: '/dashboard/trading',
    wallet: '/dashboard/wallet',
    portfolio: '/dashboard/portfolio',
    // ... more routes
  },
  admin: {
    home: '/admin',
    users: '/admin/users',
    brokers: '/admin/brokers',
    // ... more routes
  },
  broker: {
    home: '/broker',
    users: '/broker/users',
    // ... more routes
  },
};
```

### 7. Configuration Management

#### Environment Variables
- API endpoints
- Feature flags
- Theme configuration
- Limit defaults

#### Configuration Service
```typescript
// lib/config/index.ts
export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    timeout: 30000,
  },
  features: {
    trading: true,
    staking: true,
    nft: true,
    // ... feature flags
  },
  limits: {
    // Default limits (can be overridden by admin)
    kyc: {
      L0: { /* ... */ },
      L1: { /* ... */ },
      // ...
    },
  },
};
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0"
  }
}
```

## Testing Strategy

- Unit tests for utilities and hooks
- Integration tests for API client
- Component tests for shared components
- E2E tests for authentication flow

## Success Criteria

1. ✅ All shared components are reusable and documented
2. ✅ Authentication flow works with role-based redirects
3. ✅ API client handles all error cases gracefully
4. ✅ State management is centralized and type-safe
5. ✅ Routing supports role-based access control
6. ✅ Configuration is centralized and environment-aware

## Next Steps

After completing Phase 1, proceed to:
- Phase 2: Navigation (builds on routing structure)
- Phase 3: KYC System (uses auth and API client)
- Phase 4: Role-Based Access (uses auth and routing)
