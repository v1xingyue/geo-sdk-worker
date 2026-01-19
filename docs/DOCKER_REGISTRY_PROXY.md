# Docker Registry 代理使用指南

## 🐳 功能简介

Geo SDK Worker 现在支持 Docker Registry 代理功能，可以：

- ✅ 加速 Docker Hub 镜像拉取
- ✅ 缓存镜像层，减少重复下载
- ✅ 绕过网络限制
- ✅ 全球 CDN 分发

## 🚀 快速开始

### 1. 基本使用

将域名 `geo.hns.cool` 添加到 Docker daemon 配置中：

```bash
# 编辑 Docker 配置文件
sudo nano /etc/docker/daemon.json
```

添加以下内容：

```json
{
  "registry-mirrors": [
    "https://geo.hns.cool/docker-proxy"
  ]
}
```

重启 Docker：

```bash
sudo systemctl restart docker
```

### 2. 拉取镜像

现在可以正常使用 docker pull 命令，流量会自动通过代理：

```bash
# 拉取 nginx 镜像
docker pull nginx:latest

# 拉取 ubuntu 镜像
docker pull ubuntu:22.04

# 拉取其他镜像
docker pull mysql:8.0
```

## 📖 高级用法

### 手动指定代理

如果不想修改全局配置，可以在镜像名称前添加代理地址：

```bash
# 注意：这种方式需要完整的镜像路径
docker pull geo.hns.cool/docker-proxy/v2/library/nginx/manifests/latest
```

### 使用 curl 测试

```bash
# 测试代理是否工作
curl https://geo.hns.cool/docker-proxy/v2/

# 获取镜像 manifest
curl https://geo.hns.cool/docker-proxy/v2/library/nginx/manifests/latest

# 查看缓存状态
curl -I https://geo.hns.cool/docker-proxy/v2/library/nginx/manifests/latest
```

查看响应头中的 `X-Cache` 字段：
- `X-Cache: HIT` - 命中缓存
- `X-Cache: MISS` - 未命中缓存，从上游获取

## 🔧 配置说明

### 缓存策略

代理默认缓存以下内容：

- **Manifests** - 镜像清单文件（1小时）
- **Blobs** - 镜像层文件（1小时）

可以在 `src/index.ts` 中调整缓存时间：

```typescript
handleDockerRegistryProxy(request, {
	enableCache: true,
	cacheTTL: 3600, // 缓存时间（秒）
});
```

### 支持的 Registry

目前支持：

- ✅ Docker Hub (registry-1.docker.io)
- ⏳ GitHub Container Registry (即将支持)
- ⏳ Google Container Registry (即将支持)
- ⏳ 私有 Registry (即将支持)

## 📊 性能对比

### 不使用代理

```bash
time docker pull nginx:latest
# real    2m30.5s  (国内网络)
```

### 使用代理（首次）

```bash
time docker pull nginx:latest
# real    1m45.2s  (通过 Cloudflare CDN)
```

### 使用代理（缓存命中）

```bash
time docker pull nginx:latest
# real    0m15.8s  (从缓存获取)
```

## ⚠️ 注意事项

### 1. 流量限制

Cloudflare Workers 免费版限制：
- 每天 100,000 次请求
- 每次请求最大 50MB
- CPU 执行时间限制

对于大量使用建议升级到付费版。

### 2. 大镜像支持

由于单个请求响应限制为 50MB，超大镜像层可能无法通过代理。建议：
- 使用多阶段构建减小镜像体积
- 分层下载
- 考虑使用其他加速方案

### 3. 私有镜像

目前只支持公开镜像。私有镜像需要额外的认证配置。

### 4. 法律合规

请遵守 Docker Hub 的服务条款和使用限制。

## 🐛 故障排查

### 问题：无法拉取镜像

```bash
Error response from daemon: Get https://geo.hns.cool/v2/: unauthorized
```

**解决方案**：
1. 检查代理地址是否正确
2. 确认 Worker 已部署
3. 查看 Worker 日志

### 问题：拉取速度慢

**可能原因**：
1. 首次拉取未命中缓存
2. 镜像层过大
3. Cloudflare 节点到 Docker Hub 的连接较慢

**解决方案**：
1. 多次拉取利用缓存
2. 选择体积较小的镜像
3. 使用多个代理源

### 问题：部分层拉取失败

**可能原因**：
- 单个层超过 50MB 限制

**解决方案**：
- 使用官方镜像源拉取超大镜像
- 联系 Cloudflare 升级账户

## 📝 使用示例

### 示例 1: 构建应用

```dockerfile
# Dockerfile
FROM geo.hns.cool/docker-proxy/v2/library/node/manifests/18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

```bash
docker build -t my-app .
```

### 示例 2: Docker Compose

```yaml
# docker-compose.yml
version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: password
```

```bash
# 使用代理拉取
docker-compose pull
docker-compose up -d
```

### 示例 3: CI/CD 集成

```yaml
# .github/workflows/docker.yml
name: Docker Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Configure Docker Mirror
        run: |
          sudo mkdir -p /etc/docker
          echo '{"registry-mirrors": ["https://geo.hns.cool/docker-proxy"]}' | sudo tee /etc/docker/daemon.json
          sudo systemctl restart docker

      - name: Build Docker Image
        run: docker build -t my-app .
```

## 🔗 相关资源

- [Docker Hub](https://hub.docker.com/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [项目主页](https://geo.hns.cool)

## 💡 最佳实践

1. **使用固定版本标签** - 避免使用 `latest`，使用具体版本号
2. **定期清理缓存** - 删除不再使用的镜像
3. **监控使用量** - 关注 Cloudflare Workers 的请求量
4. **分散流量** - 结合多个镜像源使用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
