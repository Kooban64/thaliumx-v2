"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fluidex_js_1 = require("fluidex.js");
const client_1 = require("../client");
const exchange_helper_1 = require("../exchange_helper");
const config_1 = require("../config");
const accounts_1 = require("../accounts");
const assert_1 = require("assert");
const botsIds = [1, 2, 3, 4, 5];
const apiServer = process.env.API_ENDPOINT || "0.0.0.0:8765";
async function loadAccounts() {
    for (const user_id of botsIds) {
        let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(user_id).mnemonic);
        console.log("acc", user_id, acc);
        client_1.defaultClient.addAccount(user_id, acc);
    }
}
async function initClient() {
    await client_1.defaultClient.connect();
}
async function registerAccounts() {
    for (const user_id of botsIds) {
        let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(user_id).mnemonic);
        await client_1.defaultClient.client.RegisterUser({
            user_id,
            l1_address: acc.ethAddr,
            l2_pubkey: acc.bjjPubKey,
        });
    }
}
async function initAssets() {
    for (const user_id of botsIds) {
        await (0, exchange_helper_1.depositAssets)({ USDT: "500000.0" }, user_id);
        for (const [name, info] of client_1.defaultClient.markets) {
            const base = info.base;
            const depositReq = {};
            depositReq[base] = "10";
            await (0, exchange_helper_1.depositAssets)(depositReq, user_id);
        }
    }
}
async function mainTest() {
    await putOrdersTest();
    await putAndResetOrdersTest();
}
// Put multiple orders
async function putOrdersTest() {
    console.log("putOrdersTest Begin");
    const userId1 = botsIds[0];
    const userId2 = botsIds[1];
    const oldOrderNum1 = await openOrderNum(userId1);
    const oldOrderNum2 = await openOrderNum(userId2);
    const res = await client_1.defaultClient.batchOrderPut("ETH_USDT", false, [
        {
            user_id: botsIds[0],
            market: "ETH_USDT",
            order_side: config_1.ORDER_SIDE_BID,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: "1",
            price: "1",
            taker_fee: config_1.fee,
            maker_fee: config_1.fee,
        },
        {
            user_id: botsIds[1],
            market: "ETH_USDT",
            order_side: config_1.ORDER_SIDE_BID,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: "1",
            price: "1",
            taker_fee: config_1.fee,
            maker_fee: config_1.fee,
        },
    ]);
    const newOrderNum1 = await openOrderNum(userId1);
    const newOrderNum2 = await openOrderNum(userId2);
    assert_1.strict.equal(newOrderNum1 - oldOrderNum1, 1);
    assert_1.strict.equal(newOrderNum2 - oldOrderNum2, 1);
    console.log("putOrdersTest End");
}
// Put and reset multiple orders
async function putAndResetOrdersTest() {
    console.log("putAndResetOrdersTest Begin");
    const userId1 = botsIds[0];
    const userId2 = botsIds[1];
    const oldOrderNum1 = await openOrderNum(userId1);
    (0, assert_1.strict)(oldOrderNum1 > 0);
    const oldOrderNum2 = await openOrderNum(userId2);
    (0, assert_1.strict)(oldOrderNum2 > 0);
    const res = await client_1.defaultClient.batchOrderPut("ETH_USDT", true, [
        {
            user_id: botsIds[0],
            market: "ETH_USDT",
            order_side: config_1.ORDER_SIDE_BID,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: "1",
            price: "1",
            taker_fee: config_1.fee,
            maker_fee: config_1.fee,
        },
        {
            user_id: botsIds[1],
            market: "ETH_USDT",
            order_side: config_1.ORDER_SIDE_BID,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: "1",
            price: "1",
            taker_fee: config_1.fee,
            maker_fee: config_1.fee,
        },
    ]);
    const newOrderNum1 = await openOrderNum(userId1);
    const newOrderNum2 = await openOrderNum(userId2);
    assert_1.strict.equal(newOrderNum1, 1);
    assert_1.strict.equal(newOrderNum2, 1);
    console.log("putAndResetOrdersTest End");
}
async function openOrderNum(userId) {
    return (await axios_1.default.get(`http://${apiServer}/api/exchange/action/orders/ETH_USDT/${userId}`)).data.orders.length;
}
async function main() {
    try {
        await loadAccounts();
        await initClient();
        await client_1.defaultClient.debugReset();
        await registerAccounts();
        await initAssets();
        await mainTest();
    }
    catch (error) {
        console.error("Caught error:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=put_batch_orders.js.map