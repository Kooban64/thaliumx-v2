'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RBACAdmin;
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
function RBACAdmin() {
    return (<div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">RBAC Management</h1>
        <button_1.Button asChild>
          <a href="/admin">Back</a>
        </button_1.Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Roles</card_1.CardTitle>
            <card_1.CardDescription>Create and manage roles</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label_1.Label htmlFor="roleName">Role name</label_1.Label>
                <input_1.Input id="roleName" placeholder="broker-admin"/>
              </div>
              <button_1.Button size="sm">Add</button_1.Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Coming soon: role list, edit, delete
            </div>
          </card_1.CardContent>
        </card_1.Card>

        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Permissions</card_1.CardTitle>
            <card_1.CardDescription>Assign permissions to roles</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-2 text-sm text-muted-foreground">
            Coming soon: permission matrix editor
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map