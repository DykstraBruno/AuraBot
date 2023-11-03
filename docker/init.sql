-- Criado automaticamente pelo Docker na primeira inicialização
-- Cria banco de teste separado

SELECT 'CREATE DATABASE aurabot_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aurabot_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE aurabot_test TO aurabot;
