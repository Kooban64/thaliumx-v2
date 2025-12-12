-- ThaliumX Compliance Services Database Initialization
-- Creates separate databases for each compliance service

-- Create databases
CREATE DATABASE cex_compliance;
CREATE DATABASE dex_compliance;
CREATE DATABASE nft_compliance;
CREATE DATABASE token_compliance;
CREATE DATABASE compliance_coordinator;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cex_compliance TO compliance_user;
GRANT ALL PRIVILEGES ON DATABASE dex_compliance TO compliance_user;
GRANT ALL PRIVILEGES ON DATABASE nft_compliance TO compliance_user;
GRANT ALL PRIVILEGES ON DATABASE token_compliance TO compliance_user;
GRANT ALL PRIVILEGES ON DATABASE compliance_coordinator TO compliance_user;

-- Connect to each database and create extensions
\c cex_compliance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c dex_compliance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c nft_compliance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c token_compliance
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c compliance_coordinator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
