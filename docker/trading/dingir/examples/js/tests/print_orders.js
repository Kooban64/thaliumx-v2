"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const assert_1 = require("assert");
require("../config");
const isCI = !!process.env.GITHUB_ACTIONS;
async function main() {
    const server = process.env.API_ENDPOINT || "0.0.0.0:8765";
    console.log("ci mode:", isCI);
    console.log("closed orders:");
    const closedOrders = (await axios_1.default.get(`http://${server}/api/exchange/panel/closedorders/ETH_USDT/3`)).data;
    console.log(closedOrders);
    if (isCI) {
        assert_1.strict.equal(closedOrders.orders.length, 2);
    }
    console.log("active orders:");
    const openOrders = (await axios_1.default.get(`http://${server}/api/exchange/action/orders/ETH_USDT/4`)).data;
    console.log(openOrders);
    if (isCI) {
        assert_1.strict.equal(openOrders.orders.length, 1);
    }
    console.log("market ticker:");
    const ticker = (await axios_1.default.get(`http://${server}/api/exchange/panel/ticker_24h/ETH_USDT`)).data;
    console.log(ticker);
    if (isCI) {
        assert_1.strict.equal(ticker.volume, 4);
        assert_1.strict.equal(ticker.quote_volume, 4.4);
    }
}
main().catch(function (e) {
    console.log(e);
    process.exit(1);
    //throw e;
});
//# sourceMappingURL=print_orders.js.map