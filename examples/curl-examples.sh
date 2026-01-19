#!/bin/bash
# Geo SDK Worker API 调用示例

echo "=========================================="
echo "Geo SDK Worker - curl 调用示例"
echo "=========================================="
echo ""

# 1. 获取当前 IP 的地理位置
echo "1. 获取当前 IP 的地理位置："
echo "命令: curl https://geo.hns.cool/api/geo"
echo ""
curl -s https://geo.hns.cool/api/geo | jq '.' 2>/dev/null || curl -s https://geo.hns.cool/api/geo
echo ""
echo ""

# 2. 查询 Google DNS (8.8.8.8)
echo "2. 查询 Google DNS (8.8.8.8)："
echo "命令: curl \"https://geo.hns.cool/api/geo-query?ip=8.8.8.8\""
echo ""
curl -s "https://geo.hns.cool/api/geo-query?ip=8.8.8.8" | jq '.' 2>/dev/null || curl -s "https://geo.hns.cool/api/geo-query?ip=8.8.8.8"
echo ""
echo ""

# 3. 查询 Cloudflare DNS (1.1.1.1)
echo "3. 查询 Cloudflare DNS (1.1.1.1)："
echo "命令: curl \"https://geo.hns.cool/api/geo-query?ip=1.1.1.1\""
echo ""
curl -s "https://geo.hns.cool/api/geo-query?ip=1.1.1.1" | jq '.' 2>/dev/null || curl -s "https://geo.hns.cool/api/geo-query?ip=1.1.1.1"
echo ""
echo ""

# 4. 查询国内 DNS (114.114.114.114)
echo "4. 查询国内 DNS (114.114.114.114)："
echo "命令: curl \"https://geo.hns.cool/api/geo-query?ip=114.114.114.114\""
echo ""
curl -s "https://geo.hns.cool/api/geo-query?ip=114.114.114.114" | jq '.' 2>/dev/null || curl -s "https://geo.hns.cool/api/geo-query?ip=114.114.114.114"
echo ""
echo ""

# 5. 获取统计信息
echo "5. 获取统计信息："
echo "命令: curl https://geo.hns.cool/api/stats"
echo ""
curl -s https://geo.hns.cool/api/stats | jq '.' 2>/dev/null || curl -s https://geo.hns.cool/api/stats
echo ""
echo ""

echo "=========================================="
echo "提示: 安装 jq 可以获得更好的 JSON 格式化输出"
echo "      macOS: brew install jq"
echo "      Linux: apt-get install jq"
echo "=========================================="
