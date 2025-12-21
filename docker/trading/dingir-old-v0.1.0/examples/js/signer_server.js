"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fluidex_js_1 = require("fluidex.js");
let PROTO_PATH = __dirname + "/ordersigner.proto";
let grpc = require("@grpc/grpc-js");
let protoLoader = require("@grpc/proto-loader");
let packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
let ordersigner = grpc.loadPackageDefinition(packageDefinition).ordersigner;
const client_1 = require("./client");
// FIXME
// account11
const ethPrivKey = "0x7105836e5d903f273075ab50429c36c08afb0b786986c3612b522bf59bcecc20";
const acc = fluidex_js_1.Account.fromPrivkey(ethPrivKey);
const uid = 3;
client_1.defaultClient.addAccount(uid, acc);
async function signOrder(call, callback) {
    let inputOrder = call.request;
    console.log({ inputOrder });
    //let accountID = call.accountID;
    let { user_id, market, order_side, order_type, amount, price, taker_fee, maker_fee } = inputOrder;
    // FIXME
    if (uid != user_id) {
        throw new Error("set user key first!");
    }
    //order_type = ORDER_TYPE_LIMIT;
    //order_side = ORDER_SIDE_BID;
    let signedOrder = await client_1.defaultClient.createOrder(user_id, market, order_side, order_type, amount, price, taker_fee, maker_fee);
    console.log({ signedOrder });
    //console.log(await client.client.orderPut(signedOrder));
    callback(null, { signature: signedOrder.signature });
}
/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
function main() {
    let server = new grpc.Server();
    server.addService(ordersigner.OrderSigner.service, { signOrder: signOrder });
    server.bindAsync("0.0.0.0:50061", grpc.ServerCredentials.createInsecure(), () => {
        server.start();
    });
}
main();
//# sourceMappingURL=signer_server.js.map