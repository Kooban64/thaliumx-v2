export declare function printBalance(printList?: string[]): Promise<void>;
export declare function depositAssets(assets: any, userId: number): Promise<void>;
export declare function putLimitOrder(userId: any, market: any, side: any, amount: any, price: any): Promise<any>;
export declare function putRandOrder(userId: any, market: any): Promise<void>;
export declare function getPriceOfCoin(sym: any, timeout?: number, // default 1min
backend?: string): Promise<number>;
//# sourceMappingURL=exchange_helper.d.ts.map