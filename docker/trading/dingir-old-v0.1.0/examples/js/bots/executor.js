"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeOrders = executeOrders;
async function executeOrders(client, market, uid, reset, orders, minAmount, verbose) {
    if (reset) {
        await client.orderCancelAll(uid, market);
    }
    for (const o of orders) {
        const { user_id, market, order_side, order_type, amount, price } = o;
        try {
            if (Number(amount) > minAmount) {
                let res = await client.orderPut(user_id, market, order_side, order_type, amount, price, "0", "0");
                if (verbose) {
                    console.log("put", res);
                }
            }
        }
        catch (e) {
            console.log("put error", o, e);
        }
    }
}
//# sourceMappingURL=executor.js.map