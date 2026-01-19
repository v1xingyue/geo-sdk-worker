# Docker Registry 认证使用指南

## 🔐 认证要求

从现在开始，Docker Registry 代理需要认证才能使用。这样可以：
- ✅ 防止滥用和恶意请求
- ✅ 跟踪使用情况
- ✅ 控制访问权限
- ✅ 更好的资源管理

## 📝 获取凭证

### 步骤 1: 访问网站并登录

1. 访问 [https://geo.hns.cool](https://geo.hns.cool)
2. 点击「使用 GitHub 登录」按钮
3. 授权 GitHub OAuth 应用

### 步骤 2: 申请 API Key

登录后，在网站上申请 API Key，你会获得：

```json
{
  "appId": "app_xxxxxxxxxxxx",
  "apiKey": "sk_xxxxxxxxxxxxxxxx"
}
```

**重要**：
- `appId` 是你的用户名
- `apiKey` 是你的密码
- 请妥善保管这些凭证！

## 🚀 使用方法

### 1. Docker Login

使用获得的凭证登录：

```bash
# 使用 appId 作为用户名，apiKey 作为密码
docker login geo.hns.cool

# 输入凭证：
# Username: app_xxxxxxxxxxxx
# Password: sk_xxxxxxxxxxxxxxxx
```

成功后会看到：
```
Login Succeeded
```

### 2. 拉取镜像

登录后就可以正常拉取镜像了：

```bash
# 拉取镜像（自动使用代理）
docker pull geo.hns.cool/library/nginx:latest
docker pull geo.hns.cool/library/alpine:latest
docker pull geo.hns.cool/library/mysql:8.0
```

**注意**：镜像路径需要加上域名前缀！

### 3. 使用示例

```bash
# 1. 登录
docker login geo.hns.cool
Username: app_abc123
Password: sk_xyz789

# 2. 拉取镜像
docker pull geo.hns.cool/library/nginx:latest

# 3. 运行容器
docker run -d -p 80:80 geo.hns.cool/library/nginx:latest

# 4. 查看镜像
docker images | grep geo.hns.cool
```

## ⚙️ 配置镜像源（可选）

如果想让所有 `docker pull` 自动使用代理，可以配置镜像源：

### Linux 配置

```bash
# 1. 先登录
docker login geo.hns.cool

# 2. 编辑配置
sudo nano /etc/docker/daemon.json
```

添加内容：
```json
{
  "registry-mirrors": ["https://geo.hns.cool"]
}
```

```bash
# 3. 重启 Docker
sudo systemctl restart docker

# 4. 现在可以直接拉取镜像（会自动通过代理）
docker pull nginx:latest
```

### macOS/Windows Docker Desktop

1. 打开 Docker Desktop Settings
2. 进入 Docker Engine
3. 添加配置：

```json
{
  "registry-mirrors": ["https://geo.hns.cool"]
}
```

4. Apply & Restart
5. 使用 `docker login geo.hns.cool` 登录

## 🔍 验证认证

### 测试认证是否生效

```bash
# 未登录时，应该返回 401 错误
curl -I https://geo.hns.cool/docker-proxy/v2/

# 应该看到：
# HTTP/2 401
# WWW-Authenticate: Bearer realm="https://geo.hns.cool/docker-auth/token"...
```

### 查看登录状态

```bash
# 查看 Docker 配置中的凭证
cat ~/.docker/config.json

# 应该看到 geo.hns.cool 的认证信息
```

## 🔄 凭证管理

### 更新凭证

如果需要更新或重新登录：

```bash
# 登出
docker logout geo.hns.cool

# 重新登录
docker login geo.hns.cool
```

### 多个账户

你可以在网站上创建多个 API Key，用于不同的用途：

```bash
# 个人开发环境
docker login geo.hns.cool
Username: app_dev_key
Password: sk_dev_secret

# CI/CD 环境
# 使用另一个 API Key
```

## 📊 使用统计

登录后，你可以在网站上查看：
- API Key 使用次数
- 最后使用时间
- 流量统计

## ⚠️ 常见问题

### 问题 1: 登录失败

```
Error response from daemon: Get https://geo.hns.cool/v2/: unauthorized
```

**解决方案**：
1. 检查 appId 和 apiKey 是否正确
2. 确认 API Key 未过期或被删除
3. 在网站上重新生成 API Key

### 问题 2: 拉取镜像失败

```
Error response from daemon: unauthorized: authentication required
```

**解决方案**：
1. 确认已经登录：`docker login geo.hns.cool`
2. 检查镜像路径是否正确（需要带域名前缀）
3. 重新登录试试

### 问题 3: 镜像路径问题

❌ 错误：
```bash
docker pull nginx:latest  # 这会直接从 Docker Hub 拉取
```

✅ 正确：
```bash
docker pull geo.hns.cool/library/nginx:latest
```

或者配置镜像源后：
```bash
docker pull nginx:latest  # 会自动通过代理
```

## 🔒 安全最佳实践

### 1. 保护凭证

```bash
# ❌ 不要这样做
echo "sk_your_api_key" > api_key.txt
git add api_key.txt  # 千万不要提交到 Git！

# ✅ 使用环境变量
export DOCKER_PASSWORD="sk_your_api_key"
echo $DOCKER_PASSWORD | docker login geo.hns.cool --username app_your_id --password-stdin
```

### 2. CI/CD 中使用

GitHub Actions 示例：

```yaml
name: Build Docker Image

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Login to Registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login geo.hns.cool --username ${{ secrets.DOCKER_USERNAME }} --password-stdin

      - name: Pull Base Image
        run: docker pull geo.hns.cool/library/node:18-alpine

      - name: Build Image
        run: docker build -t myapp .
```

在 GitHub Secrets 中设置：
- `DOCKER_USERNAME`: 你的 appId
- `DOCKER_PASSWORD`: 你的 apiKey

### 3. 定期轮换凭证

建议每 3-6 个月更换一次 API Key：

1. 在网站上生成新的 API Key
2. 更新所有使用旧凭证的地方
3. 删除旧的 API Key

## 💡 高级用法

### 使用多个 Registry

```bash
# 配置多个镜像源
{
  "registry-mirrors": [
    "https://geo.hns.cool",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}

# 分别登录
docker login geo.hns.cool
docker login docker.mirrors.ustc.edu.cn
```

### 脚本自动化

```bash
#!/bin/bash
# auto-login.sh

DOCKER_USER="app_your_id"
DOCKER_PASS="sk_your_api_key"

echo "$DOCKER_PASS" | docker login geo.hns.cool --username "$DOCKER_USER" --password-stdin

if [ $? -eq 0 ]; then
    echo "✅ Docker login successful"
    docker pull geo.hns.cool/library/nginx:latest
else
    echo "❌ Docker login failed"
    exit 1
fi
```

## 📖 相关文档

- [获取 API Key](https://geo.hns.cool)
- [Docker Registry 代理文档](DOCKER_REGISTRY_PROXY.md)
- [常见问题](https://geo.hns.cool)

## 🆘 需要帮助？

如果遇到问题：
1. 查看本文档的「常见问题」部分
2. 访问网站查看使用统计
3. 提交 GitHub Issue

---

**注意**：请妥善保管你的 API Key，不要分享给他人或提交到公开代码库！
