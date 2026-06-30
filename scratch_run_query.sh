#!/bin/bash
docker cp /tmp/query_db.py dressapp-backend:/tmp/query_db.py
docker exec -e PYTHONPATH=/app/backend dressapp-backend python /tmp/query_db.py
