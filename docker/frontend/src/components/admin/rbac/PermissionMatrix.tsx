'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Check, X } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface PermissionMatrixProps {
  roles: Role[];
}

/**
 * PermissionMatrix - Display permission matrix for roles
 */
export function PermissionMatrix({ roles }: PermissionMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Get all unique permissions from all roles
  const allPermissions = Array.from(
    new Set(roles.flatMap((role) => role.permissions || []))
  ).filter((perm) =>
    searchTerm ? perm.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

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
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.id || role.name}
                      className="px-4 py-3 text-center text-sm font-medium text-foreground"
                    >
                      {role.name || role.id}
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
                  allPermissions.map((permission) => (
                    <tr key={permission} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{permission}</div>
                      </td>
                      {roles.map((role) => {
                        const hasPermission = role.permissions?.includes(permission);
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
