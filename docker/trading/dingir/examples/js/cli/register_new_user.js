"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const accounts_1 = require("../accounts");
const fluidex_js_1 = require("fluidex.js");
const client_1 = require("../client");
async function main() {
    let acc = fluidex_js_1.Account.fromPrivkey((0, accounts_1.getTestAccount)(15).priv_key);
    console.log((0, accounts_1.getTestAccount)(15).priv_key);
    let resp = await client_1.defaultClient.registerUser({
        user_id: 0, // discard in server side
        l1_address: acc.ethAddr,
        l2_pubkey: acc.bjjPubKey,
    });
    console.log(resp);
}
main();
//# sourceMappingURL=register_new_user.js.map