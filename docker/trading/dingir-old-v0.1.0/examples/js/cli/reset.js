"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../client");
async function main() {
    //    Dotenv.config()
    try {
        await client_1.defaultClient.debugReset();
    }
    catch (error) {
        console.error("Caught error:", error);
    }
}
main();
//# sourceMappingURL=reset.js.map