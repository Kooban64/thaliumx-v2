import { Client as grpcClient } from "../client";
declare function estimateMarketOrderSell(client: grpcClient, market: any, baseAmount: number): Promise<{
    base: number;
    quote: number;
    avgPrice: number;
    bestPrice: number;
    worstPrice: number;
}>;
declare function estimateMarketOrderBuy(client: grpcClient, market: any, quoteAmount: number): Promise<{
    base: number;
    quote: number;
    avgPrice: number;
    bestPrice: number;
    worstPrice: number;
}>;
declare function execMarketOrderAsLimit_Sell(client: grpcClient, market: any, baseAmount: string, uid: any): Promise<void>;
declare function execMarketOrderAsLimit_Buy(client: grpcClient, market: any, quoteAmount: string, uid: any): Promise<void>;
declare function rebalance(user_id: any, baseCoin: any, quoteCoin: any, market: any): Promise<boolean>;
declare function totalBalance(user_id: any, baseCoin: any, quoteCoin: any, market: any, externalPrice?: null): Promise<{
    quote: number;
    base: number;
    quoteValue: number;
    baseValue: number;
    totalValue: number;
    totalValueInBase: number;
}>;
declare function printBalance(user_id: any, baseCoin: any, quoteCoin: any, market: any): Promise<void>;
export { estimateMarketOrderSell, estimateMarketOrderBuy, execMarketOrderAsLimit_Sell, execMarketOrderAsLimit_Buy, rebalance, printBalance, totalBalance, };
//# sourceMappingURL=utils.d.ts.map