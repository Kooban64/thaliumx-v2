import Decimal from "decimal.js";
import { Account } from "fluidex.js";
declare class Client {
    client: any;
    markets: Map<string, any>;
    assets: Map<string, any>;
    accounts: Map<number, Account>;
    constructor(server?: string);
    addAccount(account_id: number, acc: Account): void;
    connect(): Promise<void>;
    balanceQuery(user_id: any): Promise<Map<string, any>>;
    balanceQueryByAsset(user_id: any, asset: any): Promise<{
        available: Decimal;
        frozen: Decimal;
        total: Decimal;
    }>;
    orderQuery(user_id: any, market: any): Promise<any>;
    balanceUpdate(user_id: any, asset: any, business: any, business_id: any, delta: any, detail: any): Promise<any>;
    roundOrderInput(market: any, amount: any, price: any): {
        amount: string;
        price: string;
    };
    createOrder(user_id: any, market: any, order_side: any, order_type: any, amount: any, price: any, taker_fee: any, maker_fee: any): Promise<{
        user_id: any;
        market: any;
        order_side: any;
        order_type: any;
        amount: string;
        price: string;
        taker_fee: any;
        maker_fee: any;
        signature: string;
    }>;
    orderPut(user_id: any, market: any, order_side: any, order_type: any, amount: any, price: any, taker_fee: any, maker_fee: any): Promise<any>;
    batchOrderPut(market: any, reset: any, orders: any): Promise<any>;
    assetList(): Promise<any>;
    marketList(): Promise<Map<string, any>>;
    orderDetail(market: any, order_id: any): Promise<any>;
    marketSummary(req: any): Promise<any>;
    reloadMarkets(from_scratch?: boolean): Promise<any>;
    orderCancel(user_id: any, market: any, order_id: any): Promise<any>;
    orderCancelAll(user_id: any, market: any): Promise<any>;
    orderDepth(market: any, limit: any, interval: any): Promise<any>;
    createTransferTx(from: any, to: any, asset: any, delta: any, memo: any): {
        from: any;
        to: any;
        asset: any;
        delta: any;
        memo: any;
        signature: string;
    };
    createWithdrawTx(account_id: any, asset: any, business: any, business_id: any, delta: any, detail: any): {
        user_id: any;
        asset: any;
        business: any;
        business_id: any;
        delta: number;
        detail: string;
        signature: string;
    };
    transfer(from: any, to: any, asset: any, delta: any, memo?: string): Promise<any>;
    withdraw(user_id: any, asset: any, business: any, business_id: any, delta: any, detail: any): Promise<any>;
    debugDump(): Promise<any>;
    debugReset(): Promise<any>;
    debugReload(): Promise<any>;
    registerUser(user: any): Promise<any>;
}
declare let defaultClient: Client;
export { defaultClient, Client };
//# sourceMappingURL=client.d.ts.map