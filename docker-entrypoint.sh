#!/bin/sh
set -e

echo "等待 MySQL 数据库启动..."
sleep 10

echo "启动后端 API 服务..."
cd /app/server
node index.js &

echo "所有服务已启动"
wait
