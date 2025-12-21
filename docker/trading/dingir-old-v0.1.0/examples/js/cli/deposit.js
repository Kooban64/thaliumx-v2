"use strict";
//deposit a lot to engine, so we would not encounter "balance not enough" failure
Object.defineProperty(exports, "__esModule", { value: true });
const exchange_helper_1 = require("../exchange_helper");
async function main() {
    //if I really had so much money ....
    await (0, exchange_helper_1.depositAssets)({ USDT: "10000000.0", ETH: "50000.0" }, 3);
    await (0, exchange_helper_1.depositAssets)({ USDT: "10000.0", ETH: "50.0" }, 11);
}
main().catch(console.log);
//# sourceMappingURL=deposit.js.map