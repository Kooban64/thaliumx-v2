"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.printBalance = printBalance;
exports.depositAssets = depositAssets;
exports.putLimitOrder = putLimitOrder;
exports.putRandOrder = putRandOrder;
exports.getPriceOfCoin = getPriceOfCoin;
const config_1 = require("./config"); // dotenv
const client_1 = require("./client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const gaussian = require("gaussian");
const axios_1 = __importDefault(require("axios"));
const util_1 = require("./util");
function depositId() {
    return Date.now();
}
async function printBalance(printList = ["USDT", "ETH"]) {
    const balances = await client_1.defaultClient.balanceQuery(config_1.userId);
    console.log("\nasset\tsum\tavaiable\tfrozen");
    for (const asset of printList) {
        const balance = balances.get(asset);
        console.log(asset, "\t", new decimal_js_1.default(balance.available).add(new decimal_js_1.default(balance.frozen)), "\t", balance.available, "\t", balance.frozen);
    }
    //console.log('\n');
}
async function depositAssets(assets, userId) {
    for (const [asset, amount] of Object.entries(assets)) {
        console.log("deposit", amount, asset);
        await client_1.defaultClient.balanceUpdate(userId, asset, "deposit", depositId(), amount, {
            key: "value",
        });
    }
}
async function putLimitOrder(userId, market, side, amount, price) {
    return await client_1.defaultClient.orderPut(userId, market, side, config_1.ORDER_TYPE_LIMIT, amount, price, config_1.fee, config_1.fee);
}
async function putRandOrder(userId, market) {
    // TODO: market order?
    const side = [config_1.ORDER_SIDE_ASK, config_1.ORDER_SIDE_BID][(0, util_1.getRandomInt)(0, 10000) % 2];
    const price = (0, util_1.getRandomFloat)(1350, 1450);
    const amount = (0, util_1.getRandomFloat)(0.5, 1.5);
    const order = await putLimitOrder(userId, market, side, amount, price);
    //console.log("order put", order.id.toString(), { side, price, amount });
}
let pricesCache = new Map();
let pricesUpdatedTime = 0;
async function getPriceOfCoin(sym, timeout = 60, // default 1min
backend = "coinstats") {
    // limit query rate
    if (Date.now() > pricesUpdatedTime + timeout * 1000) {
        // update prices
        try {
            if (backend == "coinstats") {
                const url = "https://api.coinstats.app/public/v1/coins?skip=0&limit=100&currency=USD";
                const data = await axios_1.default.get(url);
                for (const elem of data.data.coins) {
                    pricesCache.set(elem.symbol, elem.price);
                }
            }
            else if (backend == "cryptocompare") {
                const url = "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD";
                // TODO
            }
            pricesUpdatedTime = Date.now();
        }
        catch (e) {
            console.log("update prices err", e);
        }
    }
    return pricesCache.get(sym);
}
//# sourceMappingURL=exchange_helper.js.map