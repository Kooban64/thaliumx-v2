# Phase 1: Foundation - Todos

## Project Structure

- [ ] Create directory structure as specified in README
- [ ] Set up TypeScript path aliases in `tsconfig.json`
- [ ] Configure ESLint and Prettier
- [ ] Set up absolute imports (`@/` alias)
- [ ] Create barrel exports for shared components

## Shared Component Library

### Layout Components
- [ ] Create `AppLayout` component
- [ ] Create `DashboardLayout` component
- [ ] Create `AdminLayout` component
- [ ] Create `BrokerLayout` component
- [ ] Create `Sidebar` component with role-based menu
- [ ] Create `Header` component
- [ ] Create `Footer` component

### UI Components
- [ ] Create `LoadingSpinner` component
- [ ] Create `ErrorBoundary` component
- [ ] Create `EmptyState` component
- [ ] Create `DataTable` component with sorting/filtering
- [ ] Create `Pagination` component
- [ ] Create `Modal` component
- [ ] Create `Toast` notification system
- [ ] Create `ConfirmDialog` component

### Form Components
- [ ] Create `FormField` wrapper component
- [ ] Create `FormSelect` component
- [ ] Create `FormDatePicker` component
- [ ] Create `FormFileUpload` component
- [ ] Create form validation utilities with Zod

## Authentication & Session Management

- [ ] Enhance `lib/auth/backend-auth.ts` with better error handling
- [ ] Create `lib/auth/session.ts` for session management
- [ ] Create `lib/auth/guards.ts` for route guards
- [ ] Create Next.js `middleware.ts` for route protection
- [ ] Implement automatic token refresh
- [ ] Implement session persistence (localStorage/sessionStorage)
- [ ] Implement auto-logout on token expiry
- [ ] Add role-based route protection
- [ ] Add multi-tenant support

## API Client Enhancement

- [ ] Enhance API client with interceptors
- [ ] Implement automatic token refresh in interceptors
- [ ] Add retry logic for failed requests
- [ ] Add request cancellation support
- [ ] Add request queuing for rate limiting
- [ ] Improve error types and handling
- [ ] Add response caching (React Query)
- [ ] Create React Query hooks for common endpoints
  - [ ] `useAuth` hook
  - [ ] `useUser` hook
  - [ ] `useKYC` hook
  - [ ] `useTrading` hook
  - [ ] `useWallet` hook

## State Management

- [ ] Install and configure React Query
- [ ] Install and configure Zustand
- [ ] Create `authStore` (Zustand)
- [ ] Create `userStore` (Zustand)
- [ ] Create `kycStore` (Zustand)
- [ ] Create `uiStore` (Zustand)
- [ ] Create `configStore` (Zustand)
- [ ] Set up React Query providers
- [ ] Create custom hooks for stores

## Routing Structure

- [ ] Create route configuration file (`lib/routes/config.ts`)
- [ ] Implement `withAuth` HOC/guard
- [ ] Implement `withRole` HOC/guard
- [ ] Implement `withKYCLevel` HOC/guard
- [ ] Implement `withPermission` HOC/guard
- [ ] Create route constants for all routes
- [ ] Set up Next.js middleware for route protection
- [ ] Implement role-based redirects

## Configuration Management

- [ ] Create configuration service (`lib/config/index.ts`)
- [ ] Set up environment variable validation
- [ ] Create feature flags system
- [ ] Create theme configuration
- [ ] Create default limits configuration
- [ ] Make configuration reactive (updates from admin)

## Testing

- [ ] Set up testing framework (Vitest/Jest)
- [ ] Write unit tests for utilities
- [ ] Write unit tests for hooks
- [ ] Write integration tests for API client
- [ ] Write component tests for shared components
- [ ] Write E2E tests for authentication flow

## Documentation

- [ ] Document component API
- [ ] Document authentication flow
- [ ] Document API client usage
- [ ] Document state management patterns
- [ ] Document routing patterns
- [ ] Create developer guide
