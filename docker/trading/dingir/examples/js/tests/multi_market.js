"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fluidex_js_1 = require("fluidex.js");
const client_1 = require("../client");
const accounts_1 = require("../accounts");
const config_1 = require("../config");
const exchange_helper_1 = require("../exchange_helper");
const assert_1 = require("assert");
const userId = 1;
const isCI = !!process.env.GITHUB_ACTIONS;
const server = process.env.API_ENDPOINT || "0.0.0.0:8765";
async function initAccounts() {
    await client_1.defaultClient.debugReset();
    await client_1.defaultClient.connect();
    let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(userId).mnemonic);
    client_1.defaultClient.addAccount(userId, acc);
    await client_1.defaultClient.client.RegisterUser({
        userId,
        l1_address: acc.ethAddr,
        l2_pubkey: acc.bjjPubKey,
    });
}
async function setupAsset() {
    await (0, exchange_helper_1.depositAssets)({ USDT: "100.0", ETH: "50.0" }, userId);
}
async function orderTest() {
    const markets = Array.from(["ETH_USDT", "LINK_USDT", "MATIC_USDT", "UNI_USDT"]);
    let orders = await Promise.all(markets.map(market => client_1.defaultClient.orderPut(userId, market, config_1.ORDER_SIDE_BID, config_1.ORDER_TYPE_LIMIT, /*amount*/ "1", /*price*/ "1.1", config_1.fee, config_1.fee).then(o => [market, o.id])));
    console.log(orders);
    assert_1.strict.equal(orders.length, 4);
    const openOrders = (await axios_1.default.get(`http://${server}/api/exchange/action/orders/all/1`)).data;
    console.log(openOrders);
    if (isCI) {
        assert_1.strict.equal(openOrders.orders.length, orders.length);
    }
    await Promise.all(orders.map(([market, id]) => client_1.defaultClient.orderCancel(1, market, Number(id))));
    const closedOrders = (await axios_1.default.get(`http://${server}/api/exchange/panel/closedorders/all/1`)).data;
    console.log(closedOrders);
    if (isCI) {
        assert_1.strict.equal(closedOrders.orders.length, orders.length);
    }
}
async function main() {
    try {
        console.log("ci mode:", isCI);
        await initAccounts();
        await setupAsset();
        await orderTest();
    }
    catch (error) {
        console.error("Caught error:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=multi_market.js.map