#!/bin/bash
# Docker Registry 镜像源配置脚本
# 支持 Linux 和 macOS

echo "=========================================="
echo "Docker Registry 镜像源配置工具"
echo "=========================================="
echo ""

# 检测操作系统
OS=$(uname -s)

echo "检测到操作系统: $OS"
echo ""

# Docker daemon 配置文件路径
if [ "$OS" = "Linux" ]; then
    DOCKER_CONFIG="/etc/docker/daemon.json"
elif [ "$OS" = "Darwin" ]; then
    # macOS Docker Desktop
    echo "检测到 macOS 系统"
    echo ""
    echo "在 macOS 上，请手动配置 Docker Desktop："
    echo ""
    echo "1. 打开 Docker Desktop"
    echo "2. 点击右上角的齿轮图标（Settings）"
    echo "3. 选择 'Docker Engine'"
    echo "4. 在 JSON 配置中添加以下内容："
    echo ""
    echo '{'
    echo '  "registry-mirrors": ['
    echo '    "https://geo.hns.cool/docker-proxy"'
    echo '  ]'
    echo '}'
    echo ""
    echo "5. 点击 'Apply & Restart'"
    echo ""
    exit 0
else
    echo "不支持的操作系统: $OS"
    exit 1
fi

# Linux 系统配置
echo "配置 Docker daemon..."
echo ""

# 检查是否有 root 权限
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  需要 root 权限来修改 Docker 配置"
    echo "请使用 sudo 运行此脚本："
    echo "  sudo bash $0"
    exit 1
fi

# 创建配置目录
mkdir -p /etc/docker

# 备份现有配置
if [ -f "$DOCKER_CONFIG" ]; then
    echo "📋 备份现有配置到 ${DOCKER_CONFIG}.backup"
    cp "$DOCKER_CONFIG" "${DOCKER_CONFIG}.backup.$(date +%Y%m%d%H%M%S)"
fi

# 检查配置文件是否存在
if [ -f "$DOCKER_CONFIG" ]; then
    echo "📝 检测到现有配置文件"

    # 检查是否已经配置了镜像源
    if grep -q "registry-mirrors" "$DOCKER_CONFIG"; then
        echo "⚠️  配置文件中已存在 registry-mirrors 配置"
        echo ""
        echo "当前配置："
        cat "$DOCKER_CONFIG" | jq '.'
        echo ""
        read -p "是否覆盖现有配置？(y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "取消配置"
            exit 0
        fi
    fi

    # 使用 jq 添加或更新镜像源
    if command -v jq &> /dev/null; then
        echo "使用 jq 更新配置..."
        cat "$DOCKER_CONFIG" | jq '."registry-mirrors" = ["https://geo.hns.cool/docker-proxy"]' > "${DOCKER_CONFIG}.tmp"
        mv "${DOCKER_CONFIG}.tmp" "$DOCKER_CONFIG"
    else
        echo "未安装 jq，手动创建配置..."
        cat > "$DOCKER_CONFIG" <<EOF
{
  "registry-mirrors": [
    "https://geo.hns.cool/docker-proxy"
  ]
}
EOF
    fi
else
    echo "📝 创建新的配置文件"
    cat > "$DOCKER_CONFIG" <<EOF
{
  "registry-mirrors": [
    "https://geo.hns.cool/docker-proxy"
  ]
}
EOF
fi

echo "✅ 配置文件已更新"
echo ""
echo "当前配置："
cat "$DOCKER_CONFIG"
echo ""

# 重启 Docker 服务
echo "🔄 重启 Docker 服务..."
if command -v systemctl &> /dev/null; then
    systemctl restart docker
    if [ $? -eq 0 ]; then
        echo "✅ Docker 服务重启成功"
    else
        echo "❌ Docker 服务重启失败"
        exit 1
    fi
elif command -v service &> /dev/null; then
    service docker restart
    if [ $? -eq 0 ]; then
        echo "✅ Docker 服务重启成功"
    else
        echo "❌ Docker 服务重启失败"
        exit 1
    fi
else
    echo "⚠️  无法自动重启 Docker，请手动重启"
fi

echo ""
echo "=========================================="
echo "✅ 配置完成！"
echo "=========================================="
echo ""
echo "🧪 测试镜像拉取："
echo ""
echo "  docker pull alpine:latest"
echo "  docker pull nginx:latest"
echo ""
echo "📊 查看 Docker 信息："
echo ""
echo "  docker info | grep -A 5 'Registry Mirrors'"
echo ""
echo "🔍 验证镜像源："
docker info 2>/dev/null | grep -A 5 "Registry Mirrors" || echo "  运行 'docker info' 查看完整信息"
echo ""
echo "=========================================="
