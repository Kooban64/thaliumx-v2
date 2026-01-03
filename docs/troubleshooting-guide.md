# ThaliumX Troubleshooting Guide

## Overview

This guide provides troubleshooting procedures for the ThaliumX platform, including the core services and additional components (GraphQL, Ballerina Workflows, Live Helper Chat, osTicket).

## General Troubleshooting Steps

### 1. Check Service Status
```bash
# Check all services
./thaliumxctl.sh status

# Check specific service
docker ps | grep <service-name>

# View service logs
docker logs <container-name> --tail 100
```

### 2. Health Checks
```bash
# Core services
curl http://localhost:3002/health  # Backend
curl http://localhost:3000         # Frontend
curl http://localhost:8080/healthz # Zitadel

# Additional components
curl http://localhost:4000/health  # GraphQL
curl http://localhost:9090/health  # Ballerina Workflows
curl http://localhost:80           # Live Helper Chat / osTicket
```

### 3. Network Connectivity
```bash
# Test internal service communication
docker exec <container> ping <target-service>

# Check Docker networks
docker network ls
docker network inspect thaliumx-net
```

## Component-Specific Issues

## GraphQL API Gateway

### Symptoms
- GraphQL queries return errors
- Subscriptions not working
- High latency on queries

### Troubleshooting Steps

#### Query Errors
```bash
# Check GraphQL service logs
docker logs thaliumx-graphql

# Test backend connectivity
docker exec thaliumx-graphql curl http://thaliumx-backend:3002/health

# Verify Redis connection
docker exec thaliumx-graphql redis-cli -h thaliumx-redis ping
```

#### Subscription Issues
```bash
# Check WebSocket connections
docker exec thaliumx-graphql netstat -tlnp | grep 4000

# Verify Redis pub/sub
docker exec thaliumx-redis redis-cli pubsub channels
```

#### Performance Issues
```bash
# Check cache hit rate
docker exec thaliumx-graphql curl http://localhost:4000/metrics

# Monitor Redis memory usage
docker exec thaliumx-redis redis-cli info memory
```

### Common Solutions
- **Backend timeout**: Increase timeout in GraphQL config
- **Cache misses**: Check Redis connectivity and TTL settings
- **Schema errors**: Verify backend API compatibility

## Ballerina Workflows

### Symptoms
- Workflows not starting
- Kafka events not processed
- Workflow state stuck

### Troubleshooting Steps

#### Workflow Creation Issues
```bash
# Check Ballerina service logs
docker logs thaliumx-ballerina-workflows

# Test workflow API
curl http://localhost:9090/workflows/health

# Verify Kafka connectivity
docker exec thaliumx-ballerina-workflows kafka-console-consumer --bootstrap-server thaliumx-kafka:9092 --topic user.registration --from-beginning --max-messages 1
```

#### Event Processing Issues
```bash
# Check Kafka consumer lag
docker exec thaliumx-kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group ballerina-workflows-group

# View Kafka topics
docker exec thaliumx-kafka kafka-topics --list --bootstrap-server localhost:9092

# Test message publishing
docker exec thaliumx-kafka kafka-console-producer --broker-list localhost:9092 --topic test
```

#### Database Issues
```bash
# Check workflow state storage
docker exec thaliumx-postgres psql -U postgres -d thaliumx -c "SELECT * FROM workflow_states LIMIT 5;"

# Verify database connectivity
docker exec thaliumx-ballerina-workflows nc -zv thaliumx-postgres 5432
```

### Common Solutions
- **Kafka connection**: Check Kafka broker addresses and network
- **Event lag**: Restart consumer or check consumer group configuration
- **State persistence**: Verify database credentials and connectivity

## Live Helper Chat

### Symptoms
- Chat interface not loading
- Messages not sending
- WebSocket connection failures

### Troubleshooting Steps

#### Interface Issues
```bash
# Check chat service logs
docker logs thaliumx-live-helper-chat

# Test chat endpoint
curl http://localhost:80

# Verify Zitadel integration
docker exec thaliumx-live-helper-chat curl http://zitadel:8080/healthz
```

#### WebSocket Issues
```bash
# Check WebSocket connections
docker exec thaliumx-live-helper-chat netstat -tlnp | grep 80

# Monitor active connections
docker exec thaliumx-live-helper-chat ss -tlnp | grep 80
```

#### Database Issues
```bash
# Check chat database
docker exec thaliumx-support-postgres psql -U support -d support -c "SELECT COUNT(*) FROM lh_chat;"

# Verify database connectivity
docker exec thaliumx-live-helper-chat nc -zv thaliumx-support-postgres 5432
```

### Common Solutions
- **Auth failures**: Check Zitadel client configuration
- **WebSocket errors**: Verify firewall and proxy settings
- **Message persistence**: Check database storage and encryption

## osTicket

### Symptoms
- Ticket creation fails
- Email notifications not sent
- Admin interface inaccessible

### Troubleshooting Steps

#### Access Issues
```bash
# Check osTicket service logs
docker logs thaliumx-osticket

# Test ticket interface
curl http://localhost:80

# Verify database connectivity
docker exec thaliumx-osticket nc -zv thaliumx-support-postgres 5432
```

#### Email Issues
```bash
# Check SMTP configuration
docker exec thaliumx-osticket cat /var/www/html/include/ost-config.php | grep SMTP

# Test email sending
docker exec thaliumx-osticket php -r "mail('test@example.com', 'Test', 'Test message');"
```

#### Escalation Issues
```bash
# Check chat-to-ticket integration
docker logs thaliumx-osticket | grep -i escalation

# Verify API keys
docker exec thaliumx-osticket env | grep LHC_API
```

### Common Solutions
- **Login issues**: Reset admin password or check Zitadel integration
- **Email failures**: Verify SMTP settings and credentials
- **Escalation errors**: Check API connectivity with Live Helper Chat

## Infrastructure Issues

### Database Problems
```bash
# Check PostgreSQL health
docker exec thaliumx-postgres pg_isready -U postgres

# Monitor database performance
docker exec thaliumx-postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# Check disk space
docker exec thaliumx-postgres df -h
```

### Redis Issues
```bash
# Check Redis connectivity
docker exec thaliumx-redis redis-cli ping

# Monitor Redis memory
docker exec thaliumx-redis redis-cli info memory

# Check Redis persistence
docker exec thaliumx-redis redis-cli save
```

### Kafka Problems
```bash
# Check Kafka broker status
docker exec thaliumx-kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Monitor topic partitions
docker exec thaliumx-kafka kafka-topics --describe --bootstrap-server localhost:9092

# Check consumer groups
docker exec thaliumx-kafka kafka-consumer-groups --list --bootstrap-server localhost:9092
```

## Monitoring and Alerting

### Grafana Dashboards
- **System Overview**: Overall platform health
- **GraphQL Dashboard**: API performance and errors
- **Ballerina Workflows**: Workflow execution metrics
- **Support Services**: Chat and ticket metrics

### Alert Conditions
- Service down for >5 minutes
- Error rate >5% for 5 minutes
- Response time >2 seconds for 5 minutes
- Database connection failures
- High memory/CPU usage

## Emergency Procedures

### Service Restart
```bash
# Restart specific service
docker restart <container-name>

# Restart all services
./thaliumxctl.sh restart

# Force rebuild and restart
./thaliumxctl.sh up-build
```

### Data Recovery
```bash
# Restore from backup
./docker/scripts/restore-backup.sh <backup-file>

# Verify data integrity
./docker/scripts/verify-data-integrity.sh
```

### Escalation
1. Check logs and metrics
2. Attempt service restart
3. Contact on-call engineer
4. Declare incident if critical service affected
5. Communicate with stakeholders

## Performance Tuning

### GraphQL Optimization
- Increase Redis cache TTL
- Implement query complexity limits
- Add database indexes for common queries

### Workflow Performance
- Scale Kafka partitions
- Increase consumer threads
- Optimize database queries

### Chat Performance
- Implement rate limiting
- Add Redis caching for sessions
- Scale WebSocket servers

## Security Issues

### Authentication Problems
```bash
# Check Zitadel logs
docker logs thaliumx-zitadel

# Verify token validation
curl -H "Authorization: Bearer <token>" http://localhost:3002/api/user
```

### Access Control
```bash
# Check OPA policies
docker exec thaliumx-opa opa test /policies

# Verify role assignments
docker exec thaliumx-backend grep -r "roles" /app/logs
```

---

**Last Updated**: 2026-01-02
**Version**: 1.0</content>
</xai:function_call"> 

Assistant: Now let me mark this todo as completed and move to the next one: Prepare knowledge transfer documentation. This would be documentation for handing over the system to operations or other teams. 

<xai:function_call name="update_todo_list">
<parameter name="todos">[x] Review existing production deployment scripts and update for new components (GraphQL, Ballerina, Live Helper Chat, osTicket)\n[x] Create comprehensive production deployment script integrating all services\n[x] Update operational runbooks with procedures for new components\n[x] Create monitoring dashboards for new services in Grafana\n[x] Finalize API documentation including GraphQL schema\n[x] Create deployment verification checklist\n[x] Update troubleshooting guides\n[-] Prepare knowledge transfer documentation\n[ ] Validate production readiness across all components