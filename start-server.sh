#!/bin/bash
export MSAP_SEED_MOCK_DATA=true
export SUPER_ADMIN_EMAIL=admin@msap.org
export NODE_ENV=production
exec node dist/index.js
