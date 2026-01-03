# ThaliumX Additional Components Operational Runbook

## Overview

This runbook covers the operational procedures for the four additional components integrated into the ThaliumX platform: GraphQL API Gateway, Ballerina Workflows, Live Helper Chat, and osTicket.

## GraphQL API Gateway

### Service Details
- **Container**: `thaliumx-graphql`
- **Port**: 4000
- **Endpoint**: `/graphql` (HTTP + WebSocket)
- **Health Check**: `GET /health`

### Key Features
- Apollo Server with GraphQL Playground
- Real-time subscriptions for market data
- Caching with Redis
- Authentication via forwarded headers

### Monitoring
- Logs: `docker logs thaliumx-graphql`
- Metrics: Available via `/graphql` introspection
- Health: `curl http://localhost:4000/health`

### Troubleshooting
- **High latency**: Check Redis connection and cache hit rates
- **Subscription failures**: Verify WebSocket connections and auth headers
- **Schema errors**: Check backend API compatibility

## Ballerina Workflows

### Service Details
- **Container**: `thaliumx-ballerina-workflows`
- **Port**: 9090
- **Health Check**: `GET /workflows/health`

### Key Features
- User onboarding workflows (KYC → Account → Wallet)
- Trading order orchestration (Compliance → Reserve → Submit → Settle)
- Kafka event processing
- REST API integration

### Monitoring
- Logs: `docker logs thaliumx-ballerina-workflows`
- Workflow status: `GET /workflows/status/{workflowId}`
- Kafka consumer lag: Check Kafka UI

### Troubleshooting
- **Workflow stuck**: Check Kafka topics for missing events
- **Service unavailable**: Verify backend service connectivity
- **High error rates**: Review workflow logic and error handling

## Live Helper Chat

### Service Details
- **Container**: `thaliumx-live-helper-chat`
- **Port**: 80
- **Database**: Shared PostgreSQL (`support` schema)
- **WebSocket**: Real-time messaging

### Key Features
- Real-time chat with file sharing
- Zitadel authentication integration
- Chat history with encryption
- Moderation and analytics

### Monitoring
- Logs: `docker logs thaliumx-live-helper-chat`
- Active chats: Check database `chat_sessions` table
- WebSocket connections: Monitor container metrics

### Troubleshooting
- **Chat not loading**: Check Zitadel auth configuration
- **Messages not sending**: Verify WebSocket connections
- **File uploads failing**: Check storage permissions

## osTicket

### Service Details
- **Container**: `thaliumx-osticket`
- **Port**: 80
- **Database**: Shared PostgreSQL (`support` schema)
- **Email**: SMTP integration

### Key Features
- Ticket escalation from chat
- Priority levels and SLA tracking
- Custom fields for trading issues
- Audit trails for compliance

### Monitoring
- Logs: `docker logs thaliumx-osticket`
- Open tickets: Check database `ost_ticket` table
- SLA breaches: Monitor ticket aging

### Troubleshooting
- **Login issues**: Verify Zitadel integration
- **Email not sending**: Check SMTP configuration
- **Escalation failures**: Review chat-to-ticket workflow

## Common Operational Procedures

### Starting Services
```bash
# Start all additional components
./thaliumxctl.sh up

# Or individually
docker compose -f docker/compose/prod-v1/additional-components.yml up -d
```

### Backup and Recovery
- **Database**: Include `support` schema in PostgreSQL backups
- **Chat data**: Encrypted chat history requires special handling
- **Workflow state**: Persisted in application database

### Scaling Considerations
- **GraphQL**: Horizontal scaling with load balancer
- **Ballerina**: Stateless, can scale horizontally
- **Chat/osTicket**: Database-bound, consider read replicas

### Security
- All services integrate with Zitadel OIDC
- Chat data encrypted at rest
- OPA policies for access control
- Wazuh monitoring for security events

## Emergency Procedures

### Service Outage Response
1. Check service logs: `docker logs <container>`
2. Verify dependencies: Database, Kafka, Redis
3. Restart service: `docker restart <container>`
4. Check health endpoints
5. Escalate if manual intervention required

### Data Recovery
1. Restore from backup
2. Verify data integrity
3. Test service functionality
4. Notify stakeholders

## Maintenance Windows

### Regular Maintenance
- **Weekly**: Log rotation and cleanup
- **Monthly**: Database optimization
- **Quarterly**: Security updates and patches

### Update Procedures
1. Backup current state
2. Update Docker images
3. Test in staging environment
4. Deploy with zero-downtime strategy
5. Monitor post-deployment

## Contact Information

- **Development Team**: For code-related issues
- **DevOps Team**: For infrastructure and deployment issues
- **Support Team**: For user-facing service issues
- **Security Team**: For security incidents

---

**Last Updated**: 2026-01-02
**Version**: 1.0</content>
</xai:function_call"> 

Assistant: Now let me mark this todo as completed and move to the next one: Create monitoring dashboards for new services in Grafana. 

First, let me check what Grafana dashboards exist. There are some in docker/observability/config/grafana/dashboards/. Let me list them. 

<xai:function_call name="list_files">
<parameter name="path">docker/observability/config/grafana/dashboards