# Thaliumx Docker Orchestration Makefile
# =======================================

.PHONY: help network up down logs ps clean prune

COMPOSE_FILE := compose.yaml
NETWORK_NAME := thaliumx-net

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

network: ## Create the thaliumx network
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || docker network create --driver bridge --subnet 172.28.0.0/16 $(NETWORK_NAME)

# Service Groups
up-databases: network ## Start databases (postgres, mongodb, redis, typesense)
	docker compose -f databases/compose.yaml up -d

up-messaging: network ## Start messaging (kafka)
	docker compose -f messaging/compose.yaml up -d

up-security: network ## Start security (keycloak, vault, opa)
	docker compose -f security/compose.yaml up -d

up-gateway: network ## Start gateway (apisix, etcd)
	docker compose -f gateway/compose.yaml up -d

up-core: network ## Start core (frontend, backend)
	docker compose -f core/compose.yaml up -d

up-trading: network ## Start trading (dingir, liquibook, quantlib)
	docker compose -f trading/compose.yaml up -d

up-fintech: network ## Start fintech (ballerine, blinkfinance)
	docker compose -f fintech/compose.yaml up -d

up-observability: network ## Start observability stack
	docker compose -f observability/compose.yaml up -d

# Combined operations
up-infra: up-databases up-messaging up-security up-gateway ## Start all infrastructure services

up-apps: up-core up-trading up-fintech ## Start all application services

up: network ## Start all services
	docker compose -f $(COMPOSE_FILE) up -d

down: ## Stop all services
	docker compose -f $(COMPOSE_FILE) down

down-databases: ## Stop databases
	docker compose -f databases/compose.yaml down

down-messaging: ## Stop messaging
	docker compose -f messaging/compose.yaml down

down-security: ## Stop security
	docker compose -f security/compose.yaml down

down-gateway: ## Stop gateway
	docker compose -f gateway/compose.yaml down

down-core: ## Stop core
	docker compose -f core/compose.yaml down

down-trading: ## Stop trading
	docker compose -f trading/compose.yaml down

down-fintech: ## Stop fintech
	docker compose -f fintech/compose.yaml down

down-observability: ## Stop observability
	docker compose -f observability/compose.yaml down

# Utility commands
logs: ## View logs for all services
	docker compose -f $(COMPOSE_FILE) logs -f

logs-%: ## View logs for specific service group (e.g., make logs-databases)
	docker compose -f $*/compose.yaml logs -f

ps: ## List running containers
	docker ps --filter "name=thaliumx-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

clean: down ## Stop and remove all containers, networks
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans

prune: ## Remove all unused Docker resources
	docker system prune -af --volumes

# Health checks
health: ## Check health of all services
	@echo "=== Thaliumx Service Health ==="
	@docker ps --filter "name=thaliumx-" --format "{{.Names}}: {{.Status}}"

# Volume management
volumes: ## List all thaliumx volumes
	docker volume ls --filter "name=thaliumx-"

backup-volumes: ## Backup all volumes (creates tar files)
	@mkdir -p backups
	@for vol in $$(docker volume ls -q --filter "name=thaliumx-"); do \
		echo "Backing up $$vol..."; \
		docker run --rm -v $$vol:/data -v $$(pwd)/backups:/backup alpine tar czf /backup/$$vol.tar.gz -C /data .; \
	done

# Development helpers
shell-%: ## Open shell in container (e.g., make shell-postgres)
	docker exec -it thaliumx-$* /bin/sh

exec-%: ## Execute command in container (e.g., make exec-postgres CMD="psql -U thaliumx")
	docker exec -it thaliumx-$* $(CMD)