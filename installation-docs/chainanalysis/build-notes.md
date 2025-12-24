# ChainAnalysis Service Build Notes

## Build Process
- **Date**: 2025-12-21
- **Status**: Documentation prepared, implementation pending
- **Architecture**: Self-hosted GraphSense + Infura RPC

## Infrastructure Requirements

### GraphSense Stack
- **PostgreSQL**: 500GB+ storage, 16GB RAM, dedicated instance
- **Cassandra**: 1TB+ storage, 32GB RAM, 3-node cluster
- **Elasticsearch**: 500GB+ storage, 16GB RAM
- **GraphSense Ingestion**: 8-core CPU, 32GB RAM
- **Web UI**: 4-core CPU, 8GB RAM (optional)

### Service Requirements
- **Node.js**: >=18.0.0
- **TypeScript**: ^5.3.3
- **Memory**: 4GB minimum, 8GB recommended
- **CPU**: 2-core minimum, 4-core recommended
- **Storage**: 100GB for logs and temporary data

## Development Environment Setup

### 1. Local Development
```bash
# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with local configuration

# Development mode
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### 2. GraphSense Local Setup (Optional)
```bash
# For local GraphSense development
docker run -d \
  --name graphsense-postgres \
  -e POSTGRES_DB=graphsense \
  -e POSTGRES_USER=graphsense \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:13

# Note: Full GraphSense setup requires significant resources
# Recommend using cloud GraphSense for initial development
```

### 3. RPC Configuration
```bash
# Infura setup (development)
export INFURA_PROJECT_ID="your-project-id"
export INFURA_ETH_URL="https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}"
export INFURA_BTC_URL="https://btc-mainnet.infura.io/v3/${INFURA_PROJECT_ID}"

# Self-hosted nodes (production)
export ETH_RPC_URL="http://your-eth-node:8545"
export BTC_RPC_URL="http://your-btc-node:8332"
```

## Build Commands

### Development Build
```bash
npm run build:dev
# - TypeScript compilation
# - Source maps enabled
# - Development optimizations
```

### Production Build
```bash
npm run build
# - TypeScript compilation
# - Minification
# - Production optimizations
# - Declaration files generated
```

### Docker Build
```bash
docker build -t thaliumx-compliance-chainanalysis .
# - Multi-stage build
# - Node.js runtime optimization
# - Security hardening
```

## Testing Strategy

### Unit Tests
```bash
npm run test:unit
# - Component testing
# - Mock external dependencies
# - Fast execution (< 30 seconds)
```

### Integration Tests
```bash
npm run test:integration
# - GraphSense API integration
# - RPC connectivity testing
# - Database operations
# - Requires test environment
```

### End-to-End Tests
```bash
npm run test:e2e
# - Full workflow testing
# - Real GraphSense instance
# - Complete data pipeline
# - Requires full infrastructure
```

### Load Testing
```bash
npm run test:load
# - Performance benchmarking
# - Concurrent request handling
# - Memory usage analysis
# - Requires staging environment
```

## Deployment Strategy

### Development Deployment
```bash
# Local deployment
docker-compose -f docker-compose.dev.yml up -d

# With hot reload
npm run dev:docker
```

### Staging Deployment
```bash
# Staging environment
helm upgrade --install chainanalysis ./helm \
  --namespace staging \
  --set image.tag=latest \
  --set environment=staging
```

### Production Deployment
```bash
# Production deployment
helm upgrade --install chainanalysis ./helm \
  --namespace production \
  --set image.tag=v1.0.0 \
  --set environment=production \
  --set replicaCount=3
```

## Configuration Management

### Environment Variables
```bash
# Required
NODE_ENV=production
GRAPHSENSE_API_URL=https://graphsense.thaliumx.com
POSTGRES_URL=postgresql://chainanalysis:password@postgres:5432/chainanalysis

# Optional
LOG_LEVEL=info
METRICS_ENABLED=true
CACHE_TTL=3600
```

### Configuration Files
- `config/default.json`: Base configuration
- `config/production.json`: Production overrides
- `config/staging.json`: Staging overrides
- `config/test.json`: Test configuration

## Monitoring & Observability

### Health Checks
```bash
# Service health
GET /health

# Dependencies health
GET /health/dependencies

# Metrics endpoint
GET /metrics
```

### Logging
- **Format**: Structured JSON logs
- **Levels**: ERROR, WARN, INFO, DEBUG
- **Correlation**: Request IDs across services
- **PII Protection**: Sensitive data masked

### Metrics
- **Application Metrics**: Response times, error rates
- **Business Metrics**: Analysis throughput, risk detection rate
- **Infrastructure Metrics**: CPU, memory, disk usage

## Security Considerations

### Build Security
- **Dependency Scanning**: `npm audit` in CI/CD
- **Container Scanning**: Trivy or similar
- **SBOM Generation**: Software bill of materials

### Runtime Security
- **Non-root User**: Container runs as non-privileged user
- **Read-only Filesystem**: Where possible
- **Secret Management**: HashiCorp Vault integration
- **Network Policies**: Kubernetes network policies

## Performance Optimization

### Application Level
- **Connection Pooling**: Database and RPC connections
- **Caching Strategy**: Redis for hot data
- **Async Processing**: Non-blocking operations
- **Memory Management**: Efficient data structures

### Infrastructure Level
- **Horizontal Scaling**: Kubernetes HPA
- **Load Balancing**: NGINX or service mesh
- **CDN Integration**: For static assets
- **Database Optimization**: Indexing and query optimization

## Troubleshooting

### Common Build Issues
- **TypeScript Errors**: Run `npm run type-check` for details
- **Dependency Issues**: Clear node_modules and package-lock.json
- **Memory Issues**: Increase Node.js memory limit

### Runtime Issues
- **GraphSense Connection**: Check GraphSense service status
- **RPC Limits**: Monitor Infura usage and upgrade plan
- **Database Performance**: Check query execution plans

### Debug Commands
```bash
# Check service status
curl http://localhost:3011/health

# View application logs
docker logs thaliumx-compliance-chainanalysis

# Check GraphSense connectivity
curl http://graphsense:8080/status

# Database connectivity
npm run db:check
```

## Migration Strategy

### From Infura to Self-Hosted
1. **Parallel Operation**: Run both RPC sources
2. **Gradual Migration**: Migrate one chain at a time
3. **Performance Comparison**: Benchmark response times
4. **Fallback Plan**: Ability to switch back quickly

### GraphSense Evolution
1. **Start with Cloud**: Use managed GraphSense initially
2. **Data Migration**: Migrate historical data
3. **Feature Parity**: Ensure all features work
4. **Cutover**: Switch to self-hosted with confidence

## Cost Optimization

### Development Phase
- **Infura Free Tier**: For initial development
- **Local GraphSense**: Minimal infrastructure costs
- **Cloud Resources**: Pay-as-you-go for testing

### Production Phase
- **Reserved Instances**: For predictable workloads
- **Spot Instances**: For batch processing
- **CDN**: Reduce bandwidth costs
- **Monitoring**: Optimize resource usage

## Future Considerations

### Scalability Planning
- **Microservices Split**: Separate concerns as service grows
- **Multi-Region**: Global deployment strategy
- **Edge Computing**: Closer to blockchain nodes

### Technology Evolution
- **Rust Components**: Performance-critical parts in Rust
- **GraphQL**: More flexible API design
- **WebAssembly**: Browser-based analysis tools

---

## Implementation Status
- ✅ **Documentation**: Complete
- ✅ **Architecture**: Designed
- ✅ **Infrastructure**: Planned
- ⏳ **Implementation**: Ready to start
- ⏳ **Testing**: Pending
- ⏳ **Deployment**: Pending

*Ready for ChainAnalysis service implementation following this comprehensive build and deployment guide.*