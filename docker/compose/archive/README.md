# Archived Docker Compose Files
# ===============================
# These files are deprecated and kept for reference only
# Updated: 2025-12-17T09:05:00.000Z

## Status: DEPRECATED

**These compose files are no longer maintained or supported.**

They have been replaced by the new organized structure in `../prod-v1/`

## Migration Guide

### Old Structure → New Structure

| Old File | New Location | Status |
|----------|--------------|--------|
| `compose.production.yaml` | `prod-v1/` (split into layers) | Replaced |
| `compose.staging.yaml` | `prod-v1/` (infrastructure layer) | Replaced |
| `compose.*.yaml` | `prod-v1/` (appropriate layer) | Replaced |

### Usage Migration

**Old way:**
```bash
docker compose -f compose.production.yaml up -d
```

**New way:**
```bash
# Start foundation
docker compose -f compose/prod-v1/base.yml up -d

# Add infrastructure
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml up -d

# Add databases
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml -f compose/prod-v1/databases.yml up -d
```

## Reference Information

These files contain:
- Legacy service configurations
- Old environment variables
- Deprecated networking setups
- Historical SSL configurations

**Use for reference only** - do not use in production.

## Cleanup Plan

Once the new `prod-v1` structure is fully tested and stable:
1. Move these files to git history only
2. Remove from working directory
3. Update documentation references

## Contact

For questions about migration, see the `prod-v1/README.md` file.