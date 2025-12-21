"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalEqual = decimalEqual;
exports.assertDecimalEqual = assertDecimalEqual;
exports.decimalAdd = decimalAdd;
exports.getRandomFloat = getRandomFloat;
exports.getRandomFloatAroundNormal = getRandomFloatAroundNormal;
exports.getRandomFloatAround = getRandomFloatAround;
exports.getRandomInt = getRandomInt;
exports.getRandomElem = getRandomElem;
exports.sleep = sleep;
const decimal_js_1 = __importDefault(require("decimal.js"));
let gaussian = require("gaussian");
const assert_1 = require("assert");
function decimalEqual(a, b) {
    return new decimal_js_1.default(a).equals(new decimal_js_1.default(b));
}
function assertDecimalEqual(result, gt) {
    (0, assert_1.strict)(decimalEqual(result, gt), `${result} != ${gt}`);
}
function decimalAdd(a, b) {
    return new decimal_js_1.default(a).add(new decimal_js_1.default(b));
}
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}
function getRandomFloatAroundNormal(value, stddev_ratio = 0.02) {
    let distribution = gaussian(value, value * stddev_ratio);
    // Take a random sample using inverse transform sampling method.
    let sample = distribution.ppf(Math.random());
    return sample;
}
function getRandomFloatAround(value, ratio = 0.05, abs = 0) {
    const eps1 = getRandomFloat(-abs, abs);
    const eps2 = getRandomFloat(-value * ratio, value * ratio);
    return value + eps1 + eps2;
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}
function getRandomElem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=util.js.map