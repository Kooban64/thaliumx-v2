import { Client } from "../client";
declare class PriceBotParams {
}
declare class MMByPriceBot {
    client: Client;
    market: string;
    baseCoin: string;
    quoteCoin: string;
    params: PriceBotParams;
    latestPrice: number;
    verbose: boolean;
    name: string;
    user_id: number;
    priceFn: (coin: string) => Promise<number>;
    init(user_id: number, bot_name: string, client: Client, baseCoin: string, quoteCoin: string, market: string, params: PriceBotParams, verbose: boolean): void;
    tick(balance: any, oldOrders: any): Promise<{
        reset: any;
        orders: any;
    }>;
    handleTrade(trade: any): void;
    handleOrderbookUpdate(orderbook: any): void;
    handleOrderEvent(): void;
    getLatestPrice(): number;
    estimatePrice(): number;
    getMyBalance(): void;
}
export { MMByPriceBot };
//# sourceMappingURL=mm_external_price_bot.d.ts.map