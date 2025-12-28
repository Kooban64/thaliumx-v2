# Deprecated Keycloak realm exports

These files are kept **only for historical reference**.

The current ThaliumX production stack (`prod-v1`) standardizes on a **single realm**:

- `thaliumx-platform`

All other realm JSON exports were moved out of the active import directories to prevent accidental re-import (and accidental re-creation of legacy realms) when using directory-based Keycloak imports.

