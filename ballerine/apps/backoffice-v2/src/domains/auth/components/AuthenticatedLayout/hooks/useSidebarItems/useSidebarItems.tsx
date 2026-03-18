import {
  BuildingIcon,
  FileCheck2Icon,
  GavelIcon,
  GoalIcon,
  HomeIcon,
  LayersIcon,
  MonitorDotIcon,
  UserRoundSearchIcon,
  UsersIcon,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { useFilterId } from '@/common/hooks/useFilterId/useFilterId';
import { useLocale } from '@/common/hooks/useLocale/useLocale';
import { TRoute, TRouteWithChildren } from '@/domains/auth/components/AuthenticatedLayout/types';
import { useCustomerQuery } from '@/domains/customer/hooks/queries/useCustomerQuery/useCustomerQuery';
import { useFiltersQuery } from '@/domains/filters/hooks/queries/useFiltersQuery/useFiltersQuery';
import { useHasRole, useCanPerform } from '@/domains/auth/hooks/useHasRole';

/**
 * Role-based sidebar configuration
 * Each navigation item can have required roles and permissions
 */
const SIDEBAR_PERMISSIONS = {
  'home': { requiredRoles: [], permission: null },
  'web-presence': { requiredRoles: [], permission: 'business:read' },
  'businesses': { requiredRoles: [], permission: 'workflow:read' },
  'individuals': { requiredRoles: [], permission: 'workflow:read' },
  'kyb-and-ownership': { requiredRoles: [], permission: 'assessment:read' },
  'transaction-monitoring': { requiredRoles: [], permission: 'alert:read' },
  'identity-verification': { requiredRoles: [], permission: 'workflow:read' },
  'sanctions-screening': { requiredRoles: [], permission: 'workflow:read' },
  'documents-verification': { requiredRoles: [], permission: 'document:read' },
  'full-onboarding': { requiredRoles: [], permission: 'workflow:read' },
};

export const useSidebarItems = () => {
  const { data: filters } = useFiltersQuery();
  const locale = useLocale();
  const filterId = useFilterId();
  const individualsFilters = useMemo(
    () => filters?.filter(({ entity }) => entity === 'individuals'),
    [filters],
  );
  const businessesFilters = useMemo(
    () => filters?.filter(({ entity }) => entity === 'businesses'),
    [filters],
  );
  const { data: customer } = useCustomerQuery();

  // Role-based access checks
  const canViewWebPresence = useCanPerform('business:read');
  const canViewWorkflows = useCanPerform('workflow:read');
  const canViewAssessments = useCanPerform('assessment:read');
  const canViewAlerts = useCanPerform('alert:read');
  const canViewDocuments = useCanPerform('document:read');
  const isAdmin = useHasRole(['platform_admin', 'broker_admin']);

  const { pathname, search } = useLocation();
  const checkIsActiveFilterGroup = useCallback(
    (navItem: TRouteWithChildren) => {
      return navItem.children?.some(
        childNavItem => childNavItem.filterId === filterId || childNavItem.href === pathname,
      );
    },
    [filterId, pathname],
  );

  const businessSection = {
    text: 'Businesses',
    icon: BuildingIcon,
    children:
      businessesFilters?.map(({ id, name }) => ({
        filterId: id,
        text: name,
        key: `nav-item-${id}`,
        href: `/${locale}/case-management/entities?filterId=${id}`,
      })) ?? [],
    key: 'nav-item-businesses',
  };

  const homeNavItem = {
    text: 'Home',
    icon: HomeIcon,
    href: `/${locale}/home`,
    key: 'nav-item-home',
  };

  const webPresenceNavItem = {
    text: 'Web Presence',
    icon: MonitorDotIcon,
    href: `/${locale}/merchant-monitoring`,
    key: 'nav-item-web-presence',
  };

  const kybAndOwnershipNavItem = {
    text: 'KYB & Ownership',
    icon: BuildingIcon,
    href: `/${locale}/kyb-and-ownership`,
    key: 'nav-item-kyb-and-ownership',
  };

  // Filter nav items based on permissions
  const navItems: TRoute[] = customer?.config?.isDemoAccount
    ? [
        homeNavItem,
        ...(canViewWebPresence ? [webPresenceNavItem] : []),
        ...(customer?.config?.isDemoKybEnabled && canViewWorkflows
          ? [businessSection]
          : canViewWorkflows
          ? [
              {
                text: 'Full Onboarding (Example)',
                icon: LayersIcon,
                href: `/${locale}/case-management/entities`,
                key: 'nav-item-full-onboarding',
              },
            ]
          : []),
        ...(customer?.config?.isKybAndOwnershipAssessmentEnabled && canViewAssessments
          ? [kybAndOwnershipNavItem]
          : canViewAssessments
          ? []
          : [
              {
                text: 'KYB & Ownership',
                icon: BuildingIcon,
                premium: {
                  caption: 'Verify businesses, activity, and ownership to stay compliant.',
                  checkList: [
                    'Retrieve company registry data',
                    'Validate existence and status',
                    'Identify key stakeholders',
                  ],
                },
                key: 'nav-item-kyb-ownership',
              },
            ]),
        ...(canViewWorkflows
          ? [
              {
                text: 'Identity Verification',
                icon: UserRoundSearchIcon,
                premium: {
                  caption: 'Authenticate individuals quickly, using highest standards.',
                  checkList: [
                    'Validate government-issued IDs',
                    'Biometric and liveness checks',
                    'Global coverage',
                  ],
                },
                key: 'nav-item-identity-verification',
              },
            ]
          : []),
        ...(canViewWorkflows
          ? [
              {
                text: 'Sanctions Screening',
                icon: GavelIcon,
                premium: {
                  caption: 'Screen entities against global watchlists.',
                  checkList: [
                    'Real-time sanctions checks',
                    'Sanctions, PEPs, & adverse media',
                    'Customizable preferences',
                  ],
                },
                key: 'nav-item-sanctions-screening',
              },
            ]
          : []),
        ...(canViewDocuments
          ? [
              {
                text: 'Documents Verification',
                icon: FileCheck2Icon,
                premium: {
                  caption: 'Extract data, classify, validate and verify documents.',
                  checkList: [
                    'All types of documents',
                    'Works in every language',
                    'Detect faults and fakes',
                  ],
                },
                key: 'nav-item-documents-verifications',
              },
            ]
          : []),
      ]
    : [
        homeNavItem,
        ...(customer?.config?.isMerchantMonitoringEnabled && canViewWebPresence ? [webPresenceNavItem] : []),
        ...(canViewWorkflows ? [businessSection] : []),
        ...(canViewWorkflows
          ? [
              {
                text: 'Individuals',
                icon: UsersIcon,
                children: [
                  ...(individualsFilters?.map(({ id, name }) => ({
                    filterId: id,
                    text: name,
                    href: `/${locale}/case-management/entities?filterId=${id}`,
                    key: `nav-item-${id}`,
                  })) ?? []),
                ],
                key: 'nav-item-individuals',
              },
            ]
          : []),
        ...(customer?.config?.isKybAndOwnershipAssessmentEnabled && canViewAssessments ? [kybAndOwnershipNavItem] : []),
        // ...(customer?.config?.createIdentityVerification
        //   ? [
        //       {
        //         text: 'Identity Verification',
        //         icon: UserRoundSearchIcon,
        //         key: 'nav-item-identity-verification',
        //         href: `/${locale}/identity-verification`,
        //       },
        //     ]
        //   : []),
        ...(canViewAlerts
          ? [
              {
                text: 'Transaction Monitoring',
                icon: GoalIcon,
                children: [
                  {
                    text: 'Alerts',
                    href: `/${locale}/transaction-monitoring/alerts`,
                    key: 'nav-item-alerts',
                  },
                ],
                key: 'nav-item-transaction-monitoring',
              },
            ]
          : []),
      ];

  return {
    navItems,
    filterId,
    pathname,
    search,
    checkIsActiveFilterGroup,
  };
};
