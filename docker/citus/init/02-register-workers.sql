-- ThaliumX Citus Worker Registration Script
-- ==========================================
-- This script registers worker nodes with the coordinator
-- Run after all workers are healthy

-- Register worker nodes with the coordinator
-- Note: This runs on coordinator startup, workers may not be ready yet
-- The citus_add_node function will retry if workers aren't available

-- Add worker 1
SELECT citus_add_node('thaliumx-citus-worker-1', 5432);

-- Add worker 2
SELECT citus_add_node('thaliumx-citus-worker-2', 5432);

-- Verify workers are registered
SELECT * FROM citus_get_active_worker_nodes();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Citus worker registration complete';
END $$;