# 前端构建阶段
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY package*.json ./
RUN npm install

# 复制前端源码并构建
COPY . .
RUN npm run build

# 后端服务镜像
FROM node:20-alpine

WORKDIR /app

# 安装后端依赖
COPY server/package*.json ./server/
RUN cd server && npm install --production

# 复制后端代码
COPY server/ ./server/

# 从构建阶段复制前端静态文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 暴露端口
EXPOSE 3001 5173

# 启动脚本
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
