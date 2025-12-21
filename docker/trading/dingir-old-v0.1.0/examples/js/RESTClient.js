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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESTClient = exports.defaultRESTClient = void 0;
const axios_1 = __importDefault(require("axios"));
const _ = __importStar(require("lodash"));
const REST_API_SERVER = "http://localhost:50053/api/exchange/panel";
class UserInfo {
    id;
    l1_address;
    l2_pubkey;
}
class RESTClient {
    client;
    constructor(server = process.env.REST_API_SERVER || REST_API_SERVER) {
        console.log("using REST API server: ", server);
        this.client = axios_1.default.create({
            baseURL: server,
            timeout: 1000,
        });
    }
    async get_user_by_addr(addr) {
        let resp = await this.client.get(`/user/${addr}`);
        //console.log('user info', resp.data);
        if (resp.data.error) {
            console.log("error:", resp.data);
            return null;
        }
        let userInfo = resp.data;
        //console.log('raw', resp.data, 'result', userInfo);
        return userInfo;
    }
    async internal_txs(user_id, params) {
        let resp = await this.client.get(`/internal_txs/${user_id}`, {
            params: _.pickBy(params, _.identity),
        });
        if (resp.status === 200) {
            return resp.data;
        }
        else {
            throw new Error(`request failed with ${resp.status} ${resp.statusText}`);
        }
    }
}
exports.RESTClient = RESTClient;
let defaultRESTClient = new RESTClient();
exports.defaultRESTClient = defaultRESTClient;
//# sourceMappingURL=RESTClient.js.map