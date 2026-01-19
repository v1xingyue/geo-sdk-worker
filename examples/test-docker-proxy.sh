#!/bin/bash
# Docker Registry 代理测试脚本

echo "=========================================="
echo "Docker Registry 代理 - 测试脚本"
echo "=========================================="
echo ""

BASE_URL="https://geo.hns.cool"

# 测试基本连接
echo "1. 测试代理根路径："
echo "命令: curl ${BASE_URL}/docker-proxy/"
curl -s "${BASE_URL}/docker-proxy/" | jq '.' 2>/dev/null || curl -s "${BASE_URL}/docker-proxy/"
echo ""
echo ""

# 测试 Docker Registry v2 API
echo "2. 测试 Docker Registry v2 API："
echo "命令: curl ${BASE_URL}/docker-proxy/v2/"
curl -i "${BASE_URL}/docker-proxy/v2/" 2>&1 | head -20
echo ""
echo ""

# 测试获取 nginx 镜像的 manifest
echo "3. 测试获取 nginx 镜像 manifest："
echo "命令: curl ${BASE_URL}/docker-proxy/v2/library/nginx/manifests/latest"
curl -i -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  "${BASE_URL}/docker-proxy/v2/library/nginx/manifests/latest" 2>&1 | head -30
echo ""
echo ""

# 测试缓存状态
echo "4. 测试缓存状态（查看 X-Cache 响应头）："
echo "第一次请求（应该是 MISS）："
curl -s -I "${BASE_URL}/docker-proxy/v2/library/alpine/manifests/latest" 2>&1 | grep -i "x-cache"
echo ""
echo "第二次请求（应该是 HIT）："
curl -s -I "${BASE_URL}/docker-proxy/v2/library/alpine/manifests/latest" 2>&1 | grep -i "x-cache"
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo ""
echo "💡 使用提示："
echo "1. 配置 Docker daemon 使用代理："
echo "   sudo nano /etc/docker/daemon.json"
echo '   {"registry-mirrors": ["https://geo.hns.cool/docker-proxy"]}'
echo ""
echo "2. 重启 Docker："
echo "   sudo systemctl restart docker"
echo ""
echo "3. 拉取镜像："
echo "   docker pull nginx:latest"
echo ""
echo "📖 查看详细文档："
echo "   docs/DOCKER_REGISTRY_PROXY.md"
echo "=========================================="
