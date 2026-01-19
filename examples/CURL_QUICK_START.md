# curl 快速入门指南

这是一个快速参考指南，包含了最常用的 curl 命令来调用 Geo SDK Worker API。

## 🚀 最简单的调用

### 获取你的 IP 地址信息

```bash
curl https://geo.hns.cool/api/geo
```

这将返回你当前的 IP 地址和地理位置信息（国家、城市、经纬度、时区等）。

---

## 📍 查询指定 IP 地址

### 查询 Google DNS

```bash
curl "https://geo.hns.cool/api/geo-query?ip=8.8.8.8"
```

### 查询 Cloudflare DNS

```bash
curl "https://geo.hns.cool/api/geo-query?ip=1.1.1.1"
```

### 查询国内 114 DNS

```bash
curl "https://geo.hns.cool/api/geo-query?ip=114.114.114.114"
```

### 查询自定义 IP

```bash
curl "https://geo.hns.cool/api/geo-query?ip=YOUR_IP_ADDRESS"
```

---

## 📊 返回数据示例

```json
{
  "ip": "8.8.8.8",
  "ipVersion": "IPv4",
  "country": "US",
  "countryName": "United States",
  "city": "Ashburn",
  "region": "Virginia",
  "regionCode": "VA",
  "postalCode": "20149",
  "latitude": "39.03",
  "longitude": "-77.5",
  "timezone": "America/New_York",
  "asn": "15169",
  "asOrganization": "Google LLC",
  "isp": "Google LLC",
  "org": "Google Public DNS",
  "continent": "NA",
  "continentName": "North America",
  "timestamp": "2026-01-19T10:50:00.788Z"
}
```

---

## 💡 高级用法

### 只显示 IP 地址

```bash
curl -s https://geo.hns.cool/api/geo | grep -o '"ip":"[^"]*"' | cut -d'"' -f4
```

### 只显示国家

```bash
curl -s https://geo.hns.cool/api/geo | grep -o '"country":"[^"]*"' | cut -d'"' -f4
```

### 使用 jq 格式化输出（需要安装 jq）

```bash
curl -s https://geo.hns.cool/api/geo | jq '.'
```

### 只显示特定字段

```bash
# 显示 IP 和国家
curl -s https://geo.hns.cool/api/geo | jq '{ip, country, city}'
```

---

## 📝 其他有用的 API

### 获取统计信息

```bash
curl https://geo.hns.cool/api/stats
```

### 获取用户信息（需要登录）

```bash
curl https://geo.hns.cool/api/user
```

---

## 🔧 调试技巧

### 显示完整的 HTTP 响应头

```bash
curl -i https://geo.hns.cool/api/geo
```

### 显示详细的请求过程

```bash
curl -v https://geo.hns.cool/api/geo
```

### 设置超时时间（10秒）

```bash
curl --max-time 10 https://geo.hns.cool/api/geo
```

### 保存响应到文件

```bash
curl https://geo.hns.cool/api/geo > my-ip-info.json
```

---

## 🎯 常见使用场景

### 1. 检查服务器出口 IP

```bash
ssh user@your-server "curl -s https://geo.hns.cool/api/geo"
```

### 2. 批量查询多个 IP

```bash
for ip in 8.8.8.8 1.1.1.1 114.114.114.114; do
  echo "查询 $ip:"
  curl -s "https://geo.hns.cool/api/geo-query?ip=$ip" | jq '{ip, country, city}'
  echo ""
done
```

### 3. 定时获取 IP 信息

```bash
# 每 60 秒获取一次
watch -n 60 'curl -s https://geo.hns.cool/api/geo | jq "."'
```

### 4. 在脚本中使用

```bash
#!/bin/bash

# 获取当前 IP 信息
ip_info=$(curl -s https://geo.hns.cool/api/geo)
country=$(echo $ip_info | jq -r '.country')

if [ "$country" == "CN" ]; then
  echo "检测到中国 IP"
else
  echo "检测到海外 IP: $country"
fi
```

---

## 📦 一键运行完整示例

我们提供了一个完整的示例脚本：

```bash
bash examples/curl-examples.sh
```

---

## 🙋 需要帮助？

- 访问在线文档: [https://geo.hns.cool](https://geo.hns.cool)
- 查看完整 API 文档: [README.md](../README.md)
- 提交问题: [GitHub Issues](https://github.com/qixingyue/geo-sdk-worker/issues)
