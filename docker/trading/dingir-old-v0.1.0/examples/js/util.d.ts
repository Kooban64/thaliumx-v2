import Decimal from "decimal.js";
export declare function decimalEqual(a: any, b: any): boolean;
export declare function assertDecimalEqual(result: any, gt: any): void;
export declare function decimalAdd(a: any, b: any): Decimal;
export declare function getRandomFloat(min: any, max: any): any;
export declare function getRandomFloatAroundNormal(value: any, stddev_ratio?: number): any;
export declare function getRandomFloatAround(value: any, ratio?: number, abs?: number): any;
export declare function getRandomInt(min: any, max: any): any;
export declare function getRandomElem<T>(arr: Array<T>): T;
export declare function sleep(ms: any): Promise<unknown>;
//# sourceMappingURL=util.d.ts.map