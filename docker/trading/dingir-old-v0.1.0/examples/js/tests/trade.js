"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config"); // dotenv
const accounts_1 = require("../accounts");
const client_1 = require("../client");
const util_1 = require("../util");
const exchange_helper_1 = require("../exchange_helper");
const kafka_client_1 = require("../kafka_client");
const fluidex_js_1 = require("fluidex.js");
const assert_1 = require("assert");
const askUser = config_1.userId;
const bidUser = config_1.userId + 1;
async function infoList() {
    console.log(await client_1.defaultClient.assetList());
    console.log(await client_1.defaultClient.marketList());
    console.log(await client_1.defaultClient.marketSummary(config_1.market));
}
async function initAccounts() {
    await client_1.defaultClient.connect();
    for (let user_id = 1; user_id <= bidUser; user_id++) {
        let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(user_id).mnemonic);
        client_1.defaultClient.addAccount(user_id, acc);
        await client_1.defaultClient.client.RegisterUser({
            user_id,
            l1_address: acc.ethAddr,
            l2_pubkey: acc.bjjPubKey,
        });
    }
}
async function setupAsset() {
    // check balance is zero
    const balance1 = await client_1.defaultClient.balanceQuery(askUser);
    let usdtBalance = balance1.get("USDT");
    let ethBalance = balance1.get("ETH");
    (0, util_1.assertDecimalEqual)(usdtBalance.available, "0");
    (0, util_1.assertDecimalEqual)(usdtBalance.frozen, "0");
    (0, util_1.assertDecimalEqual)(ethBalance.available, "0");
    (0, util_1.assertDecimalEqual)(ethBalance.frozen, "0");
    await (0, exchange_helper_1.depositAssets)({ USDT: "100.0", ETH: "50.0" }, askUser);
    // check deposit success
    const balance2 = await client_1.defaultClient.balanceQuery(askUser);
    usdtBalance = balance2.get("USDT");
    ethBalance = balance2.get("ETH");
    console.log(usdtBalance);
    (0, util_1.assertDecimalEqual)(usdtBalance.available, "100");
    (0, util_1.assertDecimalEqual)(usdtBalance.frozen, "0");
    (0, util_1.assertDecimalEqual)(ethBalance.available, "50");
    (0, util_1.assertDecimalEqual)(ethBalance.frozen, "0");
    await (0, exchange_helper_1.depositAssets)({ USDT: "100.0", ETH: "50.0" }, bidUser);
}
// Test order put and cancel
async function orderTest() {
    const order = await client_1.defaultClient.orderPut(askUser, config_1.market, config_1.ORDER_SIDE_BID, config_1.ORDER_TYPE_LIMIT, /*amount*/ "10", /*price*/ "1.1", config_1.fee, config_1.fee);
    console.log(order);
    const balance3 = await client_1.defaultClient.balanceQueryByAsset(askUser, "USDT");
    (0, util_1.assertDecimalEqual)(balance3.available, "89");
    (0, util_1.assertDecimalEqual)(balance3.frozen, "11");
    const orderPending = await client_1.defaultClient.orderDetail(config_1.market, order.id);
    assert_1.strict.deepEqual(orderPending, order);
    const summary = await client_1.defaultClient.marketSummary(config_1.market);
    (0, util_1.assertDecimalEqual)(summary.bid_amount, "10");
    assert_1.strict.equal(summary.bid_count, 1);
    const depth = await client_1.defaultClient.orderDepth(config_1.market, 100, /*not merge*/ "0");
    assert_1.strict.deepEqual(depth, {
        asks: [],
        bids: [{ price: "1.10", amount: "10.0000" }],
    });
    await client_1.defaultClient.orderCancel(askUser, config_1.market, 1);
    const balance4 = await client_1.defaultClient.balanceQueryByAsset(askUser, "USDT");
    (0, util_1.assertDecimalEqual)(balance4.available, "100");
    (0, util_1.assertDecimalEqual)(balance4.frozen, "0");
    console.log("orderTest passed");
}
// Test order trading
async function tradeTest() {
    const askOrder = await client_1.defaultClient.orderPut(askUser, config_1.market, config_1.ORDER_SIDE_ASK, config_1.ORDER_TYPE_LIMIT, /*amount*/ "4", /*price*/ "1.1", config_1.fee, config_1.fee);
    const bidOrder = await client_1.defaultClient.orderPut(bidUser, config_1.market, config_1.ORDER_SIDE_BID, config_1.ORDER_TYPE_LIMIT, /*amount*/ "10", /*price*/ "1.1", config_1.fee, config_1.fee);
    console.log("ask order id", askOrder.id);
    console.log("bid order id", bidOrder.id);
    await testStatusAfterTrade(askOrder.id, bidOrder.id);
    const testReload = false;
    if (testReload) {
        await client_1.defaultClient.debugReload();
        await testStatusAfterTrade(askOrder.id, bidOrder.id);
    }
    console.log("tradeTest passed!");
    return [askOrder.id, bidOrder.id];
}
async function testStatusAfterTrade(askOrderId, bidOrderId) {
    const bidOrderPending = await client_1.defaultClient.orderDetail(config_1.market, bidOrderId);
    (0, util_1.assertDecimalEqual)(bidOrderPending.remain, "6");
    // Now, the `askOrder` will be matched and traded
    // So it will not be kept by the match engine
    await assert_1.strict.rejects(async () => {
        const askOrderPending = await client_1.defaultClient.orderDetail(config_1.market, askOrderId);
        console.log(askOrderPending);
    }, /invalid order_id/);
    // should check trade price is 1.1 rather than 1.0 here.
    const summary = await client_1.defaultClient.marketSummary(config_1.market);
    (0, util_1.assertDecimalEqual)(summary.bid_amount, "6");
    assert_1.strict.equal(summary.bid_count, 1);
    const depth = await client_1.defaultClient.orderDepth(config_1.market, 100, /*not merge*/ "0");
    //assert.deepEqual(depth, { asks: [], bids: [{ price: "1.1", amount: "6" }] });
    //assert.deepEqual(depth, { asks: [], bids: [{ price: "1.1", amount: "6" }] });
    // 4 * 1.1 sell, filled 4
    const balance1 = await client_1.defaultClient.balanceQuery(askUser);
    let usdtBalance = balance1.get("USDT");
    let ethBalance = balance1.get("ETH");
    (0, util_1.assertDecimalEqual)(usdtBalance.available, "104.4");
    (0, util_1.assertDecimalEqual)(usdtBalance.frozen, "0");
    (0, util_1.assertDecimalEqual)(ethBalance.available, "46");
    (0, util_1.assertDecimalEqual)(ethBalance.frozen, "0");
    // 10 * 1.1 buy, filled 4
    const balance2 = await client_1.defaultClient.balanceQuery(bidUser);
    usdtBalance = balance2.get("USDT");
    ethBalance = balance2.get("ETH");
    (0, util_1.assertDecimalEqual)(usdtBalance.available, "89");
    (0, util_1.assertDecimalEqual)(usdtBalance.frozen, "6.6");
    (0, util_1.assertDecimalEqual)(ethBalance.available, "54");
    (0, util_1.assertDecimalEqual)(ethBalance.frozen, "0");
}
async function simpleTest() {
    await initAccounts();
    await setupAsset();
    await orderTest();
    return await tradeTest();
}
function checkMessages(messages) {
    // TODO: more careful check
    assert_1.strict.equal(messages.get("orders").length, 5);
    assert_1.strict.equal(messages.get("balances").length, 8);
    assert_1.strict.equal(messages.get("trades").length, 1);
}
async function mainTest(withMQ) {
    await client_1.defaultClient.debugReset();
    let kafkaConsumer;
    if (withMQ) {
        kafkaConsumer = new kafka_client_1.KafkaConsumer();
        kafkaConsumer.Init();
    }
    const [askOrderId, bidOrderId] = await simpleTest();
    if (withMQ) {
        await (0, util_1.sleep)(3 * 1000);
        const messages = kafkaConsumer.GetAllMessages();
        console.log(messages);
        await kafkaConsumer.Stop();
        checkMessages(messages);
    }
}
async function main() {
    try {
        await mainTest(!!process.env.TEST_MQ || false);
    }
    catch (error) {
        console.error("Caught error:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=trade.js.map