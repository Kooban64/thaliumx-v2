"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const client_1 = require("../client");
const util_1 = require("../util");
const fluidex_js_1 = require("fluidex.js");
const accounts_1 = require("../accounts");
const assert_1 = require("assert");
const exchange_helper_1 = require("../exchange_helper");
const verbose = true;
const botsIds = [1, 2, 3, 4, 5];
let markets = [];
let prices = new Map();
function businessId() {
    return Date.now();
}
async function initClient() {
    await client_1.defaultClient.connect();
    markets = Array.from(client_1.defaultClient.markets.keys());
}
async function loadAccounts() {
    for (const user_id of botsIds) {
        let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(user_id).mnemonic);
        console.log("acc", user_id, acc);
        client_1.defaultClient.addAccount(user_id, acc);
    }
}
async function registerAccounts() {
    for (const user_id of botsIds) {
        // TODO: clean codes here
        let acc = fluidex_js_1.Account.fromMnemonic((0, accounts_1.getTestAccount)(user_id).mnemonic);
        await client_1.defaultClient.registerUser({
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
function randUser() {
    return (0, util_1.getRandomElem)(botsIds);
}
async function getPrice(token) {
    const price = await (0, exchange_helper_1.getPriceOfCoin)(token);
    if (verbose) {
        console.log("price", token, price);
    }
    return price;
}
async function cancelAllForUser(user_id) {
    for (const [market, _] of client_1.defaultClient.markets) {
        console.log("cancel all", user_id, market, await client_1.defaultClient.orderCancelAll(user_id, market));
    }
    console.log("after cancel all, balance", user_id, await client_1.defaultClient.balanceQuery(user_id));
}
async function cancelAll() {
    for (const user_id of botsIds) {
        await cancelAllForUser(user_id);
    }
}
async function transferTest() {
    console.log("successTransferTest BEGIN");
    const res1 = await client_1.defaultClient.transfer(botsIds[0], botsIds[1], "USDT", 1000);
    assert_1.strict.equal(res1.success, true);
    const res2 = await client_1.defaultClient.transfer(botsIds[1], botsIds[2], "USDT", 1000);
    assert_1.strict.equal(res2.success, true);
    const res3 = await client_1.defaultClient.transfer(botsIds[2], botsIds[3], "USDT", 1000);
    assert_1.strict.equal(res3.success, true);
    const res4 = await client_1.defaultClient.transfer(botsIds[3], botsIds[0], "USDT", 1000);
    assert_1.strict.equal(res4.success, true);
    console.log("successTransferTest END");
}
async function withdrawTest() {
    console.log("withdrawTest BEGIN");
    await client_1.defaultClient.withdraw(botsIds[0], "USDT", "withdraw", businessId(), 100, {
        key0: "value0",
    });
    await client_1.defaultClient.withdraw(botsIds[1], "USDT", "withdraw", businessId(), 100, {
        key1: "value1",
    });
    await client_1.defaultClient.withdraw(botsIds[2], "USDT", "withdraw", businessId(), 100, {
        key2: "value2",
    });
    await client_1.defaultClient.withdraw(botsIds[3], "USDT", "withdraw", businessId(), 100, {
        key3: "value3",
    });
    console.log("withdrawTest END");
}
async function run() {
    for (let cnt = 0;; cnt++) {
        try {
            await (0, util_1.sleep)(1000);
            async function tickForUser(user) {
                if (Math.floor(cnt / botsIds.length) % 200 == 0) {
                    await cancelAllForUser(user);
                }
                for (let market of markets) {
                    const price = await getPrice(market.split("_")[0]);
                    await (0, exchange_helper_1.putLimitOrder)(user, market, (0, util_1.getRandomElem)([config_1.ORDER_SIDE_BID, config_1.ORDER_SIDE_ASK]), (0, util_1.getRandomFloatAround)(0.3, 0.3), (0, util_1.getRandomFloatAroundNormal)(price));
                }
            }
            const userId = botsIds[cnt % botsIds.length];
            await tickForUser(userId);
        }
        catch (e) {
            console.log(e);
        }
    }
}
async function main() {
    const reset = true;
    await loadAccounts();
    await initClient();
    //await cancelAll();
    if (reset) {
        await client_1.defaultClient.debugReset();
        await registerAccounts();
        await initAssets();
        await transferTest();
        await withdrawTest();
    }
    await run();
}
main().catch(console.log);
//# sourceMappingURL=tick.js.map