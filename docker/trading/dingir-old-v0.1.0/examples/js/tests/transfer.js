"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config"); // dotenv
const client_1 = require("../client");
const RESTClient_1 = require("../RESTClient");
const util_1 = require("../util");
const assert_1 = require("assert");
const exchange_helper_1 = require("../exchange_helper");
const anotherUserId = config_1.userId + 10;
async function setupAsset() {
    await (0, exchange_helper_1.depositAssets)({ ETH: "100.0" }, config_1.userId);
    const balance1 = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    (0, util_1.assertDecimalEqual)(balance1.available, "100");
    const balance2 = await client_1.defaultClient.balanceQueryByAsset(anotherUserId, "ETH");
    (0, util_1.assertDecimalEqual)(balance2.available, "0");
}
async function registerUsers() {
    for (let i = 1; i <= anotherUserId; i++) {
        await client_1.defaultClient.registerUser({
            id: i,
            l1_address: "l1_address_" + i,
            l2_pubkey: "l2_pubkey_" + i,
        });
        console.log("register user", i);
    }
}
// Test failure with argument delta of value zero
async function failureWithZeroDeltaTest() {
    const res = await client_1.defaultClient.transfer(config_1.userId, anotherUserId, "ETH", 0);
    assert_1.strict.equal(res.success, false);
    assert_1.strict.equal(res.asset, "ETH");
    (0, util_1.assertDecimalEqual)(res.balance_from, "100");
    const balance1 = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    (0, util_1.assertDecimalEqual)(balance1.available, "100");
    const balance2 = await client_1.defaultClient.balanceQueryByAsset(anotherUserId, "ETH");
    (0, util_1.assertDecimalEqual)(balance2.available, "0");
    console.log("failureWithZeroDeltaTest passed");
}
// Test failure with insufficient balance of from user
async function failureWithInsufficientFromBalanceTest() {
    const res = await client_1.defaultClient.transfer(config_1.userId, anotherUserId, "ETH", 101);
    assert_1.strict.equal(res.success, false);
    assert_1.strict.equal(res.asset, "ETH");
    (0, util_1.assertDecimalEqual)(res.balance_from, "100");
    const balance1 = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    (0, util_1.assertDecimalEqual)(balance1.available, "100");
    const balance2 = await client_1.defaultClient.balanceQueryByAsset(anotherUserId, "ETH");
    (0, util_1.assertDecimalEqual)(balance2.available, "0");
    console.log("failureWithInsufficientFromBalanceTest passed");
}
// Test success transfer
async function successTransferTest() {
    const res = await client_1.defaultClient.transfer(config_1.userId, anotherUserId, "ETH", 50);
    assert_1.strict.equal(res.success, true);
    assert_1.strict.equal(res.asset, "ETH");
    (0, util_1.assertDecimalEqual)(res.balance_from, "50");
    const balance1 = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    (0, util_1.assertDecimalEqual)(balance1.available, "50");
    const balance2 = await client_1.defaultClient.balanceQueryByAsset(anotherUserId, "ETH");
    (0, util_1.assertDecimalEqual)(balance2.available, "50");
    console.log("successTransferTest passed");
}
async function listTxs() {
    const res1 = (await RESTClient_1.defaultRESTClient.internal_txs(config_1.userId))[0];
    const res2 = (await RESTClient_1.defaultRESTClient.internal_txs(anotherUserId))[0];
    console.log(res1, res2);
    assert_1.strict.equal(res1.amount, res2.amount);
    assert_1.strict.equal(res1.asset, res2.asset);
    assert_1.strict.equal(res1.time, res2.time);
    assert_1.strict.equal(res1.user_from, res2.user_from);
    assert_1.strict.equal(res1.user_to, res2.user_to);
}
async function simpleTest() {
    await setupAsset();
    await registerUsers();
    await failureWithZeroDeltaTest();
    await failureWithInsufficientFromBalanceTest();
    await successTransferTest();
    await (0, util_1.sleep)(3 * 1000);
    await listTxs();
}
async function mainTest() {
    await client_1.defaultClient.debugReset();
    await simpleTest();
}
async function main() {
    try {
        await mainTest();
    }
    catch (error) {
        console.error("Caught error:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=transfer.js.map