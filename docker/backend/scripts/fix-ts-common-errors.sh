#!/bin/bash
# Fix common TypeScript strict mode errors in route files

cd /home/ubuntu/thaliumx-clean/backend/src/routes

echo "Fixing TypeScript errors in route files..."

# Fix async handlers without return type
find . -name "*.ts" -type f -exec sed -i 's/async (req: Request, res: Response, next: NextFunction) =>/async (req: Request, res: Response, next: NextFunction): Promise<void> =>/g' {} \;

# Fix middleware without return type (non-async)
find . -name "*.ts" -type f -exec sed -i 's/(req: Request, res: Response, next: NextFunction) => {/(req: Request, res: Response, next: NextFunction): void => {/g' {} \;

echo "Done fixing common patterns"

