#!/usr/bin/env ts-node
/**
 * Database Optimization Script
 * Adds missing indexes and optimizes queries for production performance
 */
declare class DatabaseOptimizer {
    static optimize(): Promise<void>;
    private static addPerformanceIndexes;
    private static analyzeIndexes;
    private static addCompositeIndexes;
    private static updateTableStatistics;
    static validate(): Promise<void>;
}
export { DatabaseOptimizer };
//# sourceMappingURL=database-optimization.d.ts.map