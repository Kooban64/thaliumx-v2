'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Check, X } from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  resource?: string;
  action?: string;
}

interface Role {
  id: string;
  name: string;
  permissions?: Permission[] | string[];
  description?: string;
}

interface PermissionMatrixProps {
  roles: Role[];
}

/**
 * PermissionMatrix - Display permission matrix for roles
 */
export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all unique permissions from all roles
  // Handle both Permission[] objects and string[] arrays
  const allPermissions = useMemo(() => {
    const permissionSet = new Set<string>();
    
    roles.forEach((role) => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((perm) => {
          if (typeof perm === 'string') {
            permissionSet.add(perm);
          } else if (perm && typeof perm === 'object' && 'id' in perm) {
            permissionSet.add(perm.id);
          } else if (perm && typeof perm === 'object' && 'name' in perm) {
            permissionSet.add((perm as { name: string }).name);
          }
        });
      }
    });

    return Array.from(permissionSet)
      .filter((perm) =>
        searchTerm ? perm.toLowerCase().includes(searchTerm.toLowerCase()) : true
      )
      .sort();
  }, [roles, searchTerm]);

  // Helper to check if a role has a specific permission
  const roleHasPermission = (role: Role, permissionId: string): boolean => {
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return false;
    }
    
    return role.permissions.some((perm) => {
      if (typeof perm === 'string') {
        return perm === permissionId;
      }
      if (perm && typeof perm === 'object') {
        return ('id' in perm && perm.id === permissionId) || 
               ('name' in perm && perm.name === permissionId);
      }
      return false;
    });
  };

  // Get permission display name
  const getPermissionName = (permissionId: string): string => {
    // Try to find the permission in any role to get its name
    for (const role of roles) {
      if (Array.isArray(role.permissions)) {
        for (const perm of role.permissions) {
          if (typeof perm === 'object' && perm !== null) {
            if ('id' in perm && perm.id === permissionId && 'name' in perm) {
              return perm.name || permissionId;
            }
            if ('name' in perm && perm.name === permissionId) {
              return perm.name;
            }
          }
        }
      }
    }
    return permissionId;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <Input
          placeholder="Search permissions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden border rounded-lg">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground sticky left-0 bg-muted z-10">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.id || role.name}
                      className="px-4 py-3 text-center text-sm font-medium text-foreground min-w-[120px]"
                    >
                      <div className="flex flex-col">
                        <span>{role.name || role.id}</span>
                        {role.description && (
                          <span className="text-xs text-muted-foreground font-normal mt-1">
                            {role.description}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {allPermissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={roles.length + 1}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No permissions found
                    </td>
                  </tr>
                ) : (
                  allPermissions.map((permissionId) => (
                    <tr key={permissionId} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm sticky left-0 bg-background z-10">
                        <div className="font-medium">{getPermissionName(permissionId)}</div>
                        <div className="text-xs text-muted-foreground mt-1">{permissionId}</div>
                      </td>
                      {roles.map((role) => {
                        const hasPermission = roleHasPermission(role, permissionId);
                        return (
                          <td key={role.id || role.name} className="px-4 py-3 text-center">
                            {hasPermission ? (
                              <Check className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-5 w-5 text-muted-foreground mx-auto" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
        <div>
          Showing {allPermissions.length} permission{allPermissions.length !== 1 ? 's' : ''}
        </div>
        <div>
          {roles.length} role{roles.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
