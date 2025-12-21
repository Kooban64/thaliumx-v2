"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateMarketOrderSell = estimateMarketOrderSell;
exports.estimateMarketOrderBuy = estimateMarketOrderBuy;
exports.execMarketOrderAsLimit_Sell = execMarketOrderAsLimit_Sell;
exports.execMarketOrderAsLimit_Buy = execMarketOrderAsLimit_Buy;
exports.rebalance = rebalance;
exports.printBalance = printBalance;
exports.totalBalance = totalBalance;
const client_1 = require("../client");
const exchange_helper_1 = require("../exchange_helper");
const config_1 = require("../config");
// TODO: add a similar function using quoteAmount. "i want to sell some eth to get 5000 usdt"
// TODO: exclude my orders
async function estimateMarketOrderSell(client, market, baseAmount) {
    const orderbook = await client.orderDepth(market, 20, "0.01");
    //console.log('depth', orderbook);
    //console.log(client.markets);
    let quoteAcc = 0;
    let baseAcc = 0;
    let worstPrice = 0; //
    let bestPrice = Number(orderbook.bids[0].price);
    for (const elem of orderbook.bids) {
        let amount = Number(elem.amount);
        let price = Number(elem.price);
        if (baseAcc + amount > baseAmount) {
            amount = baseAmount - baseAcc;
        }
        baseAcc += amount;
        quoteAcc += amount * price;
        worstPrice = price;
    }
    let estimateResult = {
        base: baseAcc,
        quote: quoteAcc,
        avgPrice: quoteAcc / baseAcc,
        bestPrice,
        worstPrice,
    };
    //console.log("estimateMarketOrderSell:", estimateResult);
    return estimateResult;
}
async function estimateMarketOrderBuy(client, market, quoteAmount) {
    //await client.connect();
    const orderbook = await client.orderDepth(market, 20, "0.01");
    //console.log('depth', orderbook);
    //console.log(client.markets);
    let quoteAcc = 0;
    let tradeAmount = 0;
    let worstPrice = 0; //
    let bestPrice = Number(orderbook.asks[0].price);
    for (const elem of orderbook.asks) {
        let amount = Number(elem.amount);
        let price = Number(elem.price);
        let quote = amount * price;
        if (quoteAcc + quote > quoteAmount) {
            amount = (quoteAmount - quoteAcc) / price;
        }
        tradeAmount += amount;
        quoteAcc += amount * price;
        worstPrice = price;
    }
    let estimateResult = {
        base: tradeAmount,
        quote: quoteAcc,
        avgPrice: quoteAcc / tradeAmount,
        bestPrice,
        worstPrice,
    };
    //console.log("estimateMarketOrderBuy:", estimateResult);
    return estimateResult;
}
async function execMarketOrderAsLimit_Sell(client, market, baseAmount, uid) {
    /*
      let estimateResult = await estimateMarketOrderBuy(
        client,
        market,
        Number(amount)
      );
      */
    const price = "0.01"; // low enough as a market order...
    let order = await client.orderPut(uid, market, config_1.ORDER_SIDE_ASK, config_1.ORDER_TYPE_LIMIT, baseAmount, price, "0", "0");
    //console.log("execMarketOrderAsLimit_Sell", order);
}
async function execMarketOrderAsLimit_Buy(client, market, quoteAmount, uid) {
    let estimateResult = await estimateMarketOrderBuy(client, market, Number(quoteAmount));
    let order = await client.orderPut(uid, market, config_1.ORDER_SIDE_BID, config_1.ORDER_TYPE_LIMIT, estimateResult.base, estimateResult.worstPrice * 1.1, "0", "0");
    //console.log("execMarketOrderAsLimit_Buy", order);
}
async function rebalance(user_id, baseCoin, quoteCoin, market) {
    let rebalanced = false;
    const balance = await client_1.defaultClient.balanceQuery(user_id);
    const allBase = Number(balance.get(baseCoin).available) + Number(balance.get(baseCoin).frozen);
    const allQuote = Number(balance.get(quoteCoin).available) + Number(balance.get(quoteCoin).frozen);
    //onsole.log("balance when start", { balance, allBase, allQuote });
    if (allBase < 0.1) {
        await client_1.defaultClient.orderCancelAll(user_id, market);
        await execMarketOrderAsLimit_Buy(client_1.defaultClient, market, "5000", user_id);
        rebalanced = true;
    }
    if (allQuote < 1000) {
        await client_1.defaultClient.orderCancelAll(user_id, market);
        // TODO: use quote amount rather than base amount
        await execMarketOrderAsLimit_Sell(client_1.defaultClient, market, "1.5" /*base*/, user_id);
        rebalanced = true;
    }
    return rebalanced;
}
async function totalBalance(user_id, baseCoin, quoteCoin, market, externalPrice = null) {
    if (externalPrice == null) {
        externalPrice = await (0, exchange_helper_1.getPriceOfCoin)(baseCoin);
    }
    const balance = await client_1.defaultClient.balanceQuery(user_id);
    const allBase = Number(balance.get(baseCoin).available) + Number(balance.get(baseCoin).frozen);
    const allQuote = Number(balance.get(quoteCoin).available) + Number(balance.get(quoteCoin).frozen);
    return {
        quote: allQuote,
        base: allBase,
        quoteValue: allQuote, // stable coin
        baseValue: allBase * externalPrice,
        totalValue: allQuote + allBase * externalPrice,
        totalValueInBase: allQuote / externalPrice + allBase,
    };
}
async function printBalance(user_id, baseCoin, quoteCoin, market) {
    const balance = await client_1.defaultClient.balanceQuery(user_id);
    const allBase = Number(balance.get(baseCoin).available) + Number(balance.get(baseCoin).frozen);
    const allQuote = Number(balance.get(quoteCoin).available) + Number(balance.get(quoteCoin).frozen);
    let res = await estimateMarketOrderSell(client_1.defaultClient, market, allBase);
    console.log("------- BALANCE1:", {
        quote: allQuote,
        base: res.quote,
        total: allQuote + res.quote,
    });
    const externalPrice = await (0, exchange_helper_1.getPriceOfCoin)(baseCoin);
    console.log("external base price", externalPrice);
    console.log("------- BALANCE2:", {
        quote: allQuote,
        base: allBase,
        quoteValue: allQuote, // stable coin
        baseValue: allBase * externalPrice,
        totalValue: allQuote + allBase * externalPrice,
        totalValueInBase: allQuote / externalPrice + allBase,
    });
}
//# sourceMappingURL=utils.js.map