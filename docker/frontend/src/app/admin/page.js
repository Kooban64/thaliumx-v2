'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PlatformAdmin;
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
function PlatformAdmin() {
    return (<div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <button_1.Button asChild>
          <a href="/dashboard">Back to App</a>
        </button_1.Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>System Health</card_1.CardTitle>
            <card_1.CardDescription>Services and dependencies</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• API: Healthy</li>
              <li>• Exchanges: Mixed</li>
              <li>• Telemetry: Active</li>
            </ul>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Users & Brokers</card_1.CardTitle>
            <card_1.CardDescription>Manage tenants and brokers</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="flex gap-2">
              <button_1.Button size="sm" variant="outline">Users</button_1.Button>
              <button_1.Button size="sm" variant="outline">Brokers</button_1.Button>
              <button_1.Button size="sm" variant="outline">Allocations</button_1.Button>
            </div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>RBAC & Approvals</card_1.CardTitle>
            <card_1.CardDescription>Roles, permissions, workflows</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="flex gap-2">
              <button_1.Button size="sm" variant="outline" asChild>
                <a href="/admin/rbac">Open RBAC</a>
              </button_1.Button>
              <button_1.Button size="sm" variant="outline">Approvals</button_1.Button>
            </div>
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map