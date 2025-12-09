interface Bot {
    tick: (balance: any, oldOrders: any) => Promise<{
        reset: any;
        orders: any;
    }>;
}
export { Bot };
//# sourceMappingURL=bot.d.ts.map