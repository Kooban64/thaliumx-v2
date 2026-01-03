FROM osticket/osticket:latest

# Install PostgreSQL PDO driver
RUN apt-get update && \
    apt-get install -y php5-pgsql && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy custom configurations
COPY config.php /var/www/html/include/
COPY escalate-chat.php /var/www/html/

EXPOSE 80