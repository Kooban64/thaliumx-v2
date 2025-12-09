"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config"); // dotenv
const client_1 = require("../client");
const util_1 = require("../util");
const exchange_helper_1 = require("../exchange_helper");
async function stressTest({ parallel, interval, repeat }) {
    const tradeCountBefore = (await client_1.defaultClient.marketSummary(config_1.market)).trade_count;
    console.log("cancel", tradeCountBefore, "trades");
    console.log(await client_1.defaultClient.orderCancelAll(config_1.userId, config_1.market));
    await (0, exchange_helper_1.depositAssets)({ USDT: "10000000", ETH: "10000" }, config_1.userId);
    const USDTBefore = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "USDT");
    const ETHBefore = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    await (0, exchange_helper_1.printBalance)();
    const startTime = Date.now();
    function elapsedSecs() {
        return (Date.now() - startTime) / 1000;
    }
    let count = 0;
    for (;;) {
        let promises = [];
        for (let i = 0; i < parallel; i++) {
            promises.push((0, exchange_helper_1.putRandOrder)(config_1.userId, config_1.market));
        }
        await Promise.all(promises);
        if (interval > 0) {
            await (0, util_1.sleep)(interval);
        }
        count += 1;
        console.log("avg orders/s:", (parallel * count) / elapsedSecs(), "orders", parallel * count, "secs", elapsedSecs());
        if (repeat != 0 && count >= repeat) {
            break;
        }
    }
    const totalTime = elapsedSecs();
    await (0, exchange_helper_1.printBalance)();
    const USDTAfter = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "USDT");
    const ETHAfter = await client_1.defaultClient.balanceQueryByAsset(config_1.userId, "ETH");
    (0, util_1.assertDecimalEqual)(USDTAfter, USDTBefore);
    (0, util_1.assertDecimalEqual)(ETHAfter, ETHBefore);
    const tradeCountAfter = (await client_1.defaultClient.marketSummary(config_1.market)).trade_count;
    console.log("avg orders/s:", (parallel * repeat) / totalTime);
    console.log("avg trades/s:", (tradeCountAfter - tradeCountBefore) / totalTime);
    console.log("stressTest done");
}
async function main() {
    try {
        await stressTest({ parallel: 500, interval: 100, repeat: 100 });
        // await stressTest({ parallel: 1, interval: 500, repeat: 0 });
    }
    catch (error) {
        console.error("Caught error:", error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=stress.js.map