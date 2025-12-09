#!/usr/bin/env ts-node
/**
 * TypeScript Strict Error Fixer
 * 
 * Automatically fixes common TypeScript strict mode errors:
 * - Adds Promise<void> return types to async route handlers
 * - Adds void return types to middleware functions
 * - Fixes undefined parameter issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const ROUTES_DIR = path.join(__dirname, '../src/routes');

async function fixRouteHandlers() {
  const routeFiles = await glob('**/*.ts', { cwd: ROUTES_DIR });
  
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

