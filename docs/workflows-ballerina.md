# Ballerina Workflows - DEPRECATED

> **Status**: This component has been removed from the ThaliumX platform.
> 
> **Date Removed**: 2026-01-03
> 
> **Reason**: After architectural analysis, it was determined that Ballerina added unnecessary complexity (6,747 compilation errors, new language to learn, additional system to maintain) without sufficient benefits.
> 
> **Decision**: Use Backend + Ballerine approach instead:
> - **Backend**: Orchestrates all general business workflows (48 workflows)
> - **Ballerine**: Handles KYC/risk workflows only (its specialty)
> 
> **See**: `docs/workflow-orchestrator-architecture-analysis.md` for full analysis and rationale.

---

## Historical Context

This document previously described Ballerina workflow orchestration for the ThaliumX platform. The Ballerina implementation has been removed in favor of a simpler, more maintainable architecture using the existing backend for workflow orchestration.

### What Was Removed

- `docker/ballerina-workflows/` directory (entire Ballerina codebase)
- Ballerina service from docker-compose files
- All Ballerina-related deployment scripts and configurations

### Migration Path

The 48 workflows that were implemented in Ballerina will be ported to TypeScript and integrated into the backend's workflow orchestrator service. This provides:

- ✅ Single orchestration system (simpler)
- ✅ Team uses familiar technology (TypeScript/Node.js)
- ✅ No compilation errors blocking deployment
- ✅ Clear separation: Backend = general workflows, Ballerine = KYC
- ✅ Can enhance incrementally

### Next Steps

1. Create `WorkflowOrchestratorService` in backend
2. Add workflow state persistence (PostgreSQL)
3. Implement saga pattern support (using `node-saga` library)
4. Port workflow logic from Ballerina to TypeScript
5. Deploy to production

**Timeline**: 6-8 weeks to production

---

For the current workflow architecture, see:
- `docs/workflow-orchestrator-architecture-analysis.md` - Full architectural analysis
- `docs/workflows-ballerina.md` (this file) - Historical context
