# ThaliumX Docker Platform Management (Prod-v1)

This repo contains multiple Docker Compose structures. For production operations, use the **prod-v1 stack manager** exposed at repo root via [`./thaliumxctl.sh`](thaliumxctl.sh:1).

## The canonical entrypoint

Use **one** command surface:

- [`./thaliumxctl.sh`](thaliumxctl.sh:1) (wrapper)
  - delegates to [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh:1)

This manager always targets the prod-v1 compose set:

- [`docker/compose/prod-v1/*.yml`](docker/compose/prod-v1/base.yml:1)

### Why this exists

The platform uses **one-shot init jobs** (expected to run and exit) in addition to long-running containers.
Examples include gateway/bootstrap jobs.

If you only look for “running containers”, those init containers may appear “missing” because:

- they are invoked with `docker compose run --rm` and won’t persist, or
- they exit successfully after finishing.

The sanity checker accounts for this behavior: [`docker/scripts/prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1).

### Manual init jobs (not started by default)

Some init jobs are intentionally **not** part of the default `docker compose up` set (to avoid leaving extra “Exited (0)” containers around):

- Vault unseal: [`vault-unseal`](docker/compose/prod-v1/infrastructure.yml:50)
- Keycloak post-import patching: [`keycloak-post-import-seed`](docker/compose/prod-v1/applications.yml:143)

They live behind compose profile `init-jobs` and are run by the manager with `docker compose --profile init-jobs run --rm ...`.

## Commands

### Start the full production stack

```bash
./thaliumxctl.sh up
```

### Start the full stack (rebuild images + run init jobs)

```bash
./thaliumxctl.sh up-build
```

Notes:

- The prod-v1 Fintech layer (Ballerine) is configured to **build from the vendored source** in this repo (see [`docker/compose/prod-v1/fintech.yml`](docker/compose/prod-v1/fintech.yml:1)).
- If you explicitly want to run *only* prebuilt images (no local build), use the hardened runner directly with `--no-build --pull always`:

```bash
docker/scripts/prod-v1-stack.sh production --no-build --pull always
```

### Run init jobs only (idempotent)

```bash
./thaliumxctl.sh init-jobs
```

### Status / health

```bash
THALIUMX_NO_PAUSE=1 ./thaliumxctl.sh status
```

### Doctor (verbose)

```bash
THALIUMX_NO_PAUSE=1 ./thaliumxctl.sh doctor
```

Doctor runs the checker and prints:

- expected container/service counts
- missing containers
- unhealthy containers
- *origin labels* (compose project + working dir) to detect mixed compose stacks

## About “audit/non-audit”

Historically, some services (Wazuh + Ballerine + BLNK) were behind compose profile `non-audit`.
For production, **everything is required**, so the manager’s default mode is a *single full production bring-up* (equivalent to including the `non-audit` profile).

The old names are retained as aliases for backward compatibility in:

- [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh:1)
- [`docker/scripts/prod-v1-stack.sh`](docker/scripts/prod-v1-stack.sh:1)
- [`docker/scripts/prod-v1-check.sh`](docker/scripts/prod-v1-check.sh:1)

## Other Docker structures (kept for compatibility)

These remain in the repo and are not deleted:

- Deprecated orchestrator: [`docker/compose.yaml`](docker/compose.yaml:1)
- Ballerine standalone compose: [`ballerine/deploy/docker-compose.yml`](ballerine/deploy/docker-compose.yml:1)

They should not be used to start the full production platform unless you explicitly intend to run a separate stack.

## Vault assets location (important)

Vault config/scripts/tls live under [`docker/vault/`](docker/vault/docker-compose.yml:1) and are mounted into the prod-v1 stack from there (see [`docker/compose/prod-v1/infrastructure.yml`](docker/compose/prod-v1/infrastructure.yml:1)).

## Planned: Zitadel adoption (OIDC-first)

If you want a smoother authentication UX and lower operational overhead, the repo’s recommended direction is an **OIDC-first** identity layer using Zitadel as the issuer, with **tenancy implemented in the application DB** (not “realm per tenant”).

This is planned as a phased migration (Keycloak retained until proven) and includes persistence + crash recovery guidance.

See: [`docs/zitadel-adoption-plan.md`](docs/zitadel-adoption-plan.md:1)
