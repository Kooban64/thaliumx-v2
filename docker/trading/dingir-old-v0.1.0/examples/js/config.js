"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fee = exports.market = exports.quote = exports.base = exports.userId = exports.ORDER_TYPE_MARKET = exports.ORDER_TYPE_LIMIT = exports.ORDER_SIDE_BID = exports.ORDER_SIDE_ASK = exports.VERBOSE = void 0;
const Dotenv = __importStar(require("dotenv"));
Dotenv.config();
exports.VERBOSE = !!process.env.VERBOSE;
// constants
exports.ORDER_SIDE_ASK = 0;
exports.ORDER_SIDE_BID = 1;
exports.ORDER_TYPE_LIMIT = 0;
exports.ORDER_TYPE_MARKET = 1;
// fake data
exports.userId = 3;
exports.base = "ETH";
exports.quote = "USDT";
exports.market = `${exports.base}_${exports.quote}`;
exports.fee = "0";
// global config
const util_1 = require("util");
util_1.inspect.defaultOptions.depth = null;
//# sourceMappingURL=config.js.map