"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MMByPriceBot = void 0;
const config_1 = require("../config");
class PriceBotParams {
}
class MMByPriceBot {
    client;
    market;
    baseCoin;
    quoteCoin;
    params;
    latestPrice;
    verbose;
    name;
    user_id;
    priceFn;
    init(user_id, bot_name, client, baseCoin, quoteCoin, market, params, verbose) {
        this.client = client;
        this.market = market;
        this.params = params;
        this.verbose = verbose;
        this.baseCoin = baseCoin;
        this.quoteCoin = quoteCoin;
        this.name = bot_name;
        this.user_id = user_id;
    }
    // TODO: remove async
    // run every second
    async tick(balance, oldOrders) {
        const VERBOSE = this.verbose;
        const oldAskOrder = oldOrders.orders.find(elem => elem.order_side == "ASK");
        const oldBidOrder = oldOrders.orders.find(elem => elem.order_side == "BID");
        // put a big buy order and a big sell order
        //const price = await getPriceOfCoin(baseCoin, 5);
        const price = await this.priceFn(this.baseCoin);
        const allBase = Number(balance.get(this.baseCoin).available) + Number(balance.get(this.baseCoin).frozen);
        const allQuote = Number(balance.get(this.quoteCoin).available) + Number(balance.get(this.quoteCoin).frozen);
        //console.log({allBase, allQuote});
        const ratio = 0.8; // use 80% of my assets to make market
        const spread = 0.0005;
        let askPriceRaw = price * (1 + spread);
        let bidPriceRaw = price * (1 - spread);
        let bidAmountRaw = (allQuote * ratio) / bidPriceRaw;
        let askAmountRaw = allBase * ratio;
        let { price: askPrice, amount: askAmount } = this.client.roundOrderInput(this.market, askAmountRaw, askPriceRaw);
        let { price: bidPrice, amount: bidAmount } = this.client.roundOrderInput(this.market, bidAmountRaw, bidPriceRaw);
        let minAmount = 0.001;
        if (askAmountRaw < minAmount) {
            askAmount = "";
            askPrice = "";
        }
        if (bidAmountRaw < minAmount) {
            bidAmount = "";
            bidPrice = "";
        }
        // const { user_id, market, order_side, order_type, amount, price, taker_fee, maker_fee } = o;
        if (VERBOSE) {
            console.log({ bidPrice, bidAmount, askAmount, askPrice });
            //console.log({ bidPriceRaw, bidAmountRaw, askAmountRaw, askPriceRaw });
        }
        let lastBidPrice = oldBidOrder?.price || "";
        let lastBidAmount = oldBidOrder?.amount || "";
        let lastAskPrice = oldAskOrder?.price || "";
        let lastAskAmount = oldAskOrder?.amount || "";
        //if(bidPrice == lastBidPrice && bidAmount == lastBidAmount && askPrice ==lastAskPrice && askAmount == lastAskAmount) {
        if (bidPrice == lastBidPrice && askPrice == lastAskPrice) {
            if (VERBOSE) {
                console.log("same order shape, skip");
            }
            return {
                reset: false,
                orders: [],
            };
        }
        //lastAskPrice = askPrice;
        //lastAskAmount = askAmount;
        //lastBidPrice = bidPrice;
        //lastBidAmount = bidAmount;
        const bid_order = {
            user_id: this.user_id,
            market: this.market,
            order_side: config_1.ORDER_SIDE_BID,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: bidAmount,
            price: bidPrice,
        };
        const ask_order = {
            user_id: this.user_id,
            market: this.market,
            order_side: config_1.ORDER_SIDE_ASK,
            order_type: config_1.ORDER_TYPE_LIMIT,
            amount: askAmount,
            price: askPrice,
        };
        return {
            reset: true,
            orders: [bid_order, ask_order],
        };
    }
    handleTrade(trade) {
        // console.log(trade);
        return;
    }
    handleOrderbookUpdate(orderbook) {
        // console.log(orderbook);
        return;
    }
    handleOrderEvent() {
        // console.log("log info");
        return;
    }
    getLatestPrice() {
        return this.latestPrice;
    }
    estimatePrice() {
        return 3;
    }
    getMyBalance() {
        // console.log("log info");
        return;
    }
}
exports.MMByPriceBot = MMByPriceBot;
//# sourceMappingURL=mm_external_price_bot.js.map