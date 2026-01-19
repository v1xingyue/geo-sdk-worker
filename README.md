# Geo SDK Worker

🌍 一个基于 Cloudflare Workers 的地理位置感知 IP 查询工具和 JavaScript SDK

[![部署在 Cloudflare Workers](https://img.shields.io/badge/部署在-Cloudflare%20Workers-f38020?logo=cloudflare)](https://geo.hns.cool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📖 项目简介

Geo SDK Worker 是一个功能强大的 IP 地址查询工具，运行在 Cloudflare Workers 边缘网络上。它不仅提供了类似 IP138 的 IP 查询服务，还为开发者提供了地理位置感知的 JavaScript SDK。

**在线访问**: [https://geo.hns.cool](https://geo.hns.cool)

## ✨ 核心功能

### 🔍 IP 地址查询
- **自动检测** - 自动显示访问者的公网 IP 地址
- **手动查询** - 支持查询任意 IPv4/IPv6 地址
- **URL 查询** - 通过 `?ip=xxx.xxx.xxx.xxx` 直接查询
- **详细信息** - 国家、城市、经纬度、时区、ISP 等完整信息

### 🐳 Docker Registry 代理 (NEW!)
- **需要认证** - 使用 GitHub 登录获取 API Key
- **加速拉取** - 加速 Docker Hub 镜像拉取速度
- **智能缓存** - 缓存镜像层，减少重复下载
- **全球 CDN** - 利用 Cloudflare CDN 加速分发
- **使用跟踪** - 查看个人使用统计

📖 **详细文档**:
- [认证使用指南](docs/DOCKER_AUTH_GUIDE.md) ⭐ 必读
- [Docker Registry 代理说明](docs/DOCKER_REGISTRY_PROXY.md)

### 🌐 地理位置感知 SDK
- **动态加载** - 根据用户地理位置返回不同的 SDK 功能
- **轻量级** - 仅 ~10KB，压缩后 ~3KB
- **边缘计算** - 全球分布式部署，超低延迟
- **API 密钥管理** - 内置 API Key 申请和验证系统

### 🛠️ 开发者功能
- **RESTful API** - 简洁的 HTTP API 接口
- **CORS 支持** - 跨域请求友好
- **实时数据** - 基于 Cloudflare 的实时地理位置数据
- **KV 存储** - API 密钥持久化存储

## 🚀 技术栈

- **运行时**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **开发工具**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- **语言**: TypeScript
- **存储**: Cloudflare KV
- **静态资源**: Workers Assets
- **测试**: Vitest
- **第三方 API**: [ip-api.com](https://ip-api.com/)

## 📦 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Cloudflare 账号

### 本地开发

```bash
# 克隆项目
git clone https://github.com/qixingyue/geo-sdk-worker.git
cd geo-sdk-worker

# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 访问 http://localhost:8787
```

### 部署到 Cloudflare Workers

```bash
# 部署到生产环境
npm run deploy

# 生成类型定义
npm run cf-typegen
```

### 配置自定义域名

1. 在 `wrangler.jsonc` 中配置域名：
```jsonc
{
  "routes": [
    {
      "pattern": "your-domain.com",
      "custom_domain": true
    }
  ]
}
```

2. 重新部署：
```bash
npm run deploy
```

## 📚 API 文档

### 快速测试

我们提供了一个便捷的测试脚本，可以快速测试所有 API：

```bash
# 运行示例脚本
bash examples/curl-examples.sh
```

📖 **更多 curl 使用技巧**: 查看 [curl 快速入门指南](examples/CURL_QUICK_START.md)

### 1. 获取当前 IP 的地理位置

```http
GET /api/geo
```

**curl 命令：**
```bash
curl https://geo.hns.cool/api/geo
```

**响应示例：**
```json
{
  "ip": "108.181.22.203",
  "ipVersion": "IPv4",
  "country": "US",
  "countryName": "美国",
  "city": "Los Angeles",
  "region": "California",
  "latitude": "34.05223",
  "longitude": "-118.24368",
  "timezone": "America/Los_Angeles",
  "asOrganization": "Psychz Networks",
  "timestamp": "2026-01-18T10:30:45.035Z"
}
```

### 2. 查询指定 IP 地址

```http
GET /api/geo-query?ip=8.8.8.8
```

**参数：**
- `ip` (必需) - IPv4 或 IPv6 地址

**curl 命令：**
```bash
# 查询 Google DNS
curl "https://geo.hns.cool/api/geo-query?ip=8.8.8.8"

# 查询 Cloudflare DNS
curl "https://geo.hns.cool/api/geo-query?ip=1.1.1.1"

# 查询国内 DNS
curl "https://geo.hns.cool/api/geo-query?ip=114.114.114.114"
```

**响应示例：**
```json
{
  "ip": "8.8.8.8",
  "ipVersion": "IPv4",
  "country": "US",
  "countryName": "United States",
  "city": "Ashburn",
  "region": "Virginia",
  "timezone": "America/New_York",
  "asOrganization": "Google LLC",
  "isp": "Google LLC"
}
```

### 3. 加载 JavaScript SDK

```html
<script src="https://geo.hns.cool/sdk.js"></script>
```

**SDK 使用示例：**
```javascript
// 初始化 SDK
MySDK.init({
  appId: 'your-app-id',
  apiKey: 'your-api-key'
});

// 检查 SDK 可用性
if (MySDK.available) {
  console.log('SDK 版本:', MySDK.version);
  console.log('用户位置:', MySDK.country);
}

// 获取用户信息
const userInfo = MySDK.getUserInfo();
console.log(userInfo);
```

### 4. 申请 API Key

```http
POST /api/register
Content-Type: application/json

{
  "appName": "My Application",
  "email": "user@example.com"
}
```

**响应示例：**
```json
{
  "success": true,
  "appId": "app_xxxxxxxxxxxx",
  "apiKey": "sk_xxxxxxxxxxxxxxxx",
  "message": "API Key 创建成功"
}
```

### 5. 验证 API Key

```http
POST /api/validate
Content-Type: application/json

{
  "appId": "app_xxxxxxxxxxxx",
  "apiKey": "sk_xxxxxxxxxxxxxxxx"
}
```

## 🎯 使用场景

### 场景 1: Docker 镜像加速（需要认证）

```bash
# 步骤 1: 访问网站获取 API Key
# https://geo.hns.cool

# 步骤 2: 使用 GitHub 登录并申请 API Key
# 你会获得：appId 和 apiKey

# 步骤 3: Docker 登录
docker login geo.hns.cool
Username: app_xxxxxxxxxxxx  # 你的 appId
Password: sk_xxxxxxxxxxxxxxxx  # 你的 apiKey

# 步骤 4: 拉取镜像
docker pull geo.hns.cool/library/nginx:latest
docker pull geo.hns.cool/library/mysql:8.0
```

📖 详细说明：[Docker 认证使用指南](docs/DOCKER_AUTH_GUIDE.md)

### 场景 2: IP 归属地查询
```bash
# 直接通过 URL 查询
https://geo.hns.cool/?ip=8.8.8.8
```

### 场景 3: 网站访客分析
```javascript
// 在网页中集成
<script src="https://geo.hns.cool/sdk.js"></script>
<script>
  const visitor = MySDK.getUserInfo();
  console.log('访客来自:', visitor.country);
</script>
```

### 场景 3: API 集成
```javascript
// 在应用中调用 API
const response = await fetch('https://geo.hns.cool/api/geo');
const location = await response.json();
console.log('用户 IP:', location.ip);
console.log('用户城市:', location.city);
```

### 场景 4: 地域化内容
```javascript
// 根据用户位置显示不同内容
if (MySDK.country === 'CN') {
  // 显示中文内容
} else {
  // 显示英文内容
}
```

## 🏗️ 项目结构

```
geo-sdk-worker/
├── src/
│   └── index.ts           # Worker 主入口
├── public/
│   └── index.html         # 前端页面
├── test/
│   └── index.spec.ts      # 测试文件
├── wrangler.jsonc         # Wrangler 配置
├── tsconfig.json          # TypeScript 配置
├── vitest.config.mts      # Vitest 配置
├── package.json           # 项目依赖
└── README.md              # 项目文档
```

## 🔧 配置说明

### KV 命名空间

项目使用 Cloudflare KV 存储 API 密钥：

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "API_KEYS",
      "id": "your-kv-namespace-id"
    }
  ]
}
```

### 环境变量

无需额外环境变量，所有配置都在 `wrangler.jsonc` 中。

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并查看覆盖率
npm test -- --coverage
```

## 📈 性能

- **全球分布** - Cloudflare 边缘网络覆盖全球 300+ 城市
- **超低延迟** - 平均响应时间 < 50ms
- **高可用性** - 99.99% 正常运行时间
- **无限扩展** - 自动处理流量峰值

## 🌟 特性亮点

### 1. 智能地理位置检测
使用 Cloudflare 的 `request.cf` 对象获取高精度地理位置数据

### 2. IPv4/IPv6 双栈支持
自动识别和处理 IPv4 和 IPv6 地址

### 3. 动态 SDK 生成
根据用户位置动态生成不同功能的 JavaScript SDK

### 4. RESTful API 设计
简洁、直观的 API 接口设计

### 5. 零配置部署
一键部署到 Cloudflare Workers，无需复杂配置

## 🔒 安全性

- ✅ CORS 配置防止未授权访问
- ✅ API Key 验证保护敏感接口
- ✅ IP 地址格式验证防止注入攻击
- ✅ KV 存储加密保护用户数据

## 📝 开发指南

### 添加新的 API 端点

1. 在 `src/index.ts` 中添加路由：
```typescript
if (url.pathname === '/api/new-endpoint') {
  return handleNewEndpoint(request, env, corsHeaders);
}
```

2. 实现处理函数：
```typescript
async function handleNewEndpoint(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // 实现逻辑
  return new Response(JSON.stringify({ data: 'value' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### 修改 SDK 功能

编辑 `src/index.ts` 中的 `generateSDK` 函数：

```typescript
function generateSDK(isChinaMainland: boolean, country: string): string {
  // 自定义 SDK 代码
}
```

## 🤝 贡献指南

欢迎提交 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供边缘计算平台
- [ip-api.com](https://ip-api.com/) - 提供 IP 地理位置查询 API
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - 优秀的 Workers 开发工具

## 📞 联系方式

- **网站**: [https://geo.hns.cool](https://geo.hns.cool)
- **问题反馈**: [GitHub Issues](https://github.com/qixingyue/geo-sdk-worker/issues)

## 🎉 示例链接

- 查询 Google DNS: [https://geo.hns.cool/?ip=8.8.8.8](https://geo.hns.cool/?ip=8.8.8.8)
- 查询 Cloudflare DNS: [https://geo.hns.cool/?ip=1.1.1.1](https://geo.hns.cool/?ip=1.1.1.1)
- 查询 114 DNS: [https://geo.hns.cool/?ip=114.114.114.114](https://geo.hns.cool/?ip=114.114.114.114)

---

⭐️ 如果这个项目对您有帮助，请给它一个 Star！
