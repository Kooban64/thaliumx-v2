#!/usr/bin/env ts-node
"use strict";
/**
 * TypeScript Strict Error Fixer
 *
 * Automatically fixes common TypeScript strict mode errors:
 * - Adds Promise<void> return types to async route handlers
 * - Adds void return types to middleware functions
 * - Fixes undefined parameter issues
 */
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const ROUTES_DIR = path.join(__dirname, '../src/routes');
async function fixRouteHandlers() {
    const routeFiles = await (0, glob_1.glob)('**/*.ts', { cwd: ROUTES_DIR });
    for (const file of routeFiles) {
        const filePath = path.join(ROUTES_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;
        // Fix async route handlers without return type
        const asyncHandlerPattern = /export const (\w+) = async \(req: Request, res: Response, next: NextFunction\) =>/g;
        content = content.replace(asyncHandlerPattern, (match, handlerName) => {
            modified = true;
            return `export const ${handlerName} = async (req: Request, res: Response, next: NextFunction): Promise<void> =>`;
        });
        // Fix middleware functions without return type
        const middlewarePattern = /export const (\w+) = \(req: Request, res: Response, next: NextFunction\) =>/g;
        content = content.replace(middlewarePattern, (match, handlerName) => {
            if (!content.includes(`export const ${handlerName} = async`)) {
                modified = true;
                return `export const ${handlerName} = (req: Request, res: Response, next: NextFunction): void =>`;
            }
            return match;
        });
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`Fixed: ${file}`);
        }
    }
}
async function main() {
    console.log('Fixing TypeScript strict errors...');
    await fixRouteHandlers();
    console.log('Done!');
}
main().catch(console.error);
//# sourceMappingURL=fix-ts-strict-errors.js.map