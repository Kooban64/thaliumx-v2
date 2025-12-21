"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mm_external_price_bot_1 = require("./mm_external_price_bot");
const regression = __importStar(require("regression"));
const fluidex_js_1 = require("fluidex.js");
const RESTClient_1 = require("../RESTClient");
const client_1 = require("../client");
const util_1 = require("../util");
const config_1 = require("../config");
const utils_1 = require("./utils");
const executor_1 = require("./executor");
const exchange_helper_1 = require("../exchange_helper");
//const VERBOSE = false;
console.log({ VERBOSE: config_1.VERBOSE });
async function initUser() {
    const mnemonic1 = "split logic consider degree smile field term style opera dad believe indoor item type beyond";
    const mnemonic2 = "camp awful sand include refuse cash reveal mystery pupil salad length plunge square admit vocal draft found side same clock hurt length say figure";
    const mnemonic3 = "sound select report rug run cave provide index grief foster bar someone garage donate nominee crew once oil sausage flight tail holiday style afford";
    const acc = fluidex_js_1.Account.fromMnemonic(mnemonic3);
    //console.log('acc is', acc);
    const restClient = RESTClient_1.defaultRESTClient;
    let userInfo = await restClient.get_user_by_addr(acc.ethAddr);
    if (userInfo == null) {
        // register
        console.log("register new user");
        let resp = await client_1.defaultClient.registerUser({
            user_id: 0, // discard in server side
            l1_address: acc.ethAddr,
            l2_pubkey: acc.bjjPubKey,
        });
        const t = Date.now();
        console.log("register resp", resp);
        await (0, util_1.sleep)(2000); // FIXME
        userInfo = await restClient.get_user_by_addr(acc.ethAddr);
        await (0, util_1.sleep)(2000); // FIXME
        await (0, exchange_helper_1.depositAssets)({ USDT: "10000.0" }, userInfo.id);
    }
    else {
        console.log("user", "already registered");
    }
    console.log("user", userInfo);
    client_1.defaultClient.addAccount(userInfo.id, acc);
    return userInfo.id;
}
const market = "ETH_USDT";
const baseCoin = "ETH";
const quoteCoin = "USDT";
async function main() {
    const user_id = await initUser();
    await client_1.defaultClient.connect();
    await (0, utils_1.rebalance)(user_id, baseCoin, quoteCoin, market);
    let bot = new mm_external_price_bot_1.MMByPriceBot();
    bot.init(user_id, "bot1", client_1.defaultClient, baseCoin, quoteCoin, market, null, config_1.VERBOSE);
    bot.priceFn = async function (coin) {
        return await (0, exchange_helper_1.getPriceOfCoin)(coin, 5, "coinstats");
    };
    let balanceStats = [];
    let count = 0;
    const startTime = Date.now() / 1000;
    const { totalValue: totalValueWhenStart } = await (0, utils_1.totalBalance)(user_id, baseCoin, quoteCoin, market);
    while (true) {
        if (config_1.VERBOSE) {
            console.log("count:", count);
        }
        count += 1;
        if (config_1.VERBOSE) {
            console.log("sleep 500ms");
        }
        await (0, util_1.sleep)(500);
        try {
            if (count % 100 == 1) {
                const t = Date.now() / 1000; // ms
                console.log("stats of", bot.name);
                console.log("orders:");
                console.log(await client_1.defaultClient.orderQuery(user_id, market));
                console.log("balances:");
                await (0, utils_1.printBalance)(user_id, baseCoin, quoteCoin, market);
                let { totalValue } = await (0, utils_1.totalBalance)(user_id, baseCoin, quoteCoin, market);
                balanceStats.push([t, totalValue]);
                if (balanceStats.length >= 2) {
                    const pastHour = (t - startTime) / 3600;
                    const assetRatio = totalValue / totalValueWhenStart;
                    console.log("time(hour)", pastHour, "asset ratio", assetRatio);
                    console.log("current ROI per hour:", (assetRatio - 1) / pastHour);
                    // we should use exp regression rather linear
                    const hourDelta = 3600 * regression.linear(balanceStats).equation[0];
                    console.log("regression ROI per hour:", hourDelta / totalValueWhenStart);
                }
            }
            const oldOrders = await client_1.defaultClient.orderQuery(user_id, market);
            if (config_1.VERBOSE) {
                console.log("oldOrders", oldOrders);
            }
            const balance = await client_1.defaultClient.balanceQuery(user_id);
            const { reset, orders } = await bot.tick(balance, oldOrders);
            await (0, executor_1.executeOrders)(client_1.defaultClient, market, user_id, reset, orders, 0.001, false);
        }
        catch (e) {
            console.log("err", e);
        }
    }
}
main();
//# sourceMappingURL=run_bots.js.map