"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestAccount = getTestAccount;
let accounts = require("fs").readFileSync("./accounts.jsonl", "utf-8").split("\n").filter(Boolean).map(JSON.parse);
function getTestAccount(id) {
    let a = accounts[id];
    return a;
}
//# sourceMappingURL=accounts.js.map