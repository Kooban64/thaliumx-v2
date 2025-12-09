'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BrokerAdmin;
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
function BrokerAdmin() {
    return (<div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Broker Admin</h1>
        <button_1.Button asChild>
          <a href="/dashboard">Back to App</a>
        </button_1.Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Allocations</card_1.CardTitle>
            <card_1.CardDescription>User and account allocations</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Wallets</card_1.CardTitle>
            <card_1.CardDescription>Hot wallets and segregation</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Compliance</card_1.CardTitle>
            <card_1.CardDescription>Approvals and reviews</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="text-sm text-muted-foreground">Coming soon</div>
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map