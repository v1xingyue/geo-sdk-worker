# 绑定自定义域名指南

## 问题说明

`.workers.dev` 域名在中国大陆被防火墙屏蔽，导致境内用户无法访问。虽然应用的业务逻辑支持全球访问（只是对境内用户返回受限 SDK 功能），但由于域名限制，境内用户连网站都打不开。

**解决方案：绑定自定义域名**

## 前提条件

1. 您需要有一个域名（如 `example.com`）
2. 该域名需要托管在 Cloudflare（或将域名的 DNS 服务器指向 Cloudflare）

## 方法一：通过 Cloudflare Dashboard 配置（推荐）

### 步骤 1: 登录 Cloudflare Dashboard

访问 https://dash.cloudflare.com 并登录

### 步骤 2: 进入 Workers 设置

1. 点击左侧菜单的 "Workers & Pages"
2. 找到您的 Worker：`geo-sdk-worker`
3. 点击进入 Worker 详情页面

### 步骤 3: 添加自定义域名

1. 点击 "Settings" 标签
2. 找到 "Domains & Routes" 部分
3. 点击 "Add Custom Domain"
4. 输入您的域名，例如：
   - `geo-sdk.example.com`（推荐使用子域名）
   - 或 `example.com`（使用根域名）
5. 点击 "Add Domain"

Cloudflare 会自动：
- 创建 DNS 记录
- 配置 SSL 证书
- 将流量路由到您的 Worker

### 步骤 4: 等待生效

通常几分钟内就会生效。您可以访问新域名测试：
```bash
curl https://geo-sdk.example.com/api/geo
```

## 方法二：通过 wrangler.jsonc 配置

如果您希望在代码中管理域名配置，可以修改 `wrangler.jsonc`：

```jsonc
{
  "name": "geo-sdk-worker",
  "main": "src/index.ts",
  // ... 其他配置 ...

  // 添加自定义域名
  "routes": [
    {
      "pattern": "geo-sdk.example.com/*",
      "zone_name": "example.com"
    }
  ]
}
```

然后重新部署：
```bash
npm run deploy
```

## 方法三：使用 wrangler CLI 命令

```bash
# 添加自定义域名
wrangler domains add geo-sdk.example.com

# 查看已配置的域名
wrangler domains list
```

## 验证配置

配置完成后，可以通过以下方式验证：

1. **检查 DNS 解析**
```bash
nslookup geo-sdk.example.com
```

2. **测试 API 访问**
```bash
# 测试地理位置 API
curl https://geo-sdk.example.com/api/geo

# 测试首页
curl https://geo-sdk.example.com/
```

3. **在浏览器中访问**
直接访问 `https://geo-sdk.example.com`，应该可以看到首页

## 更新首页 SDK 引用

绑定域名后，记得更新首页中 SDK 的引用地址：

编辑 `public/index.html`，将所有 `geo-sdk-worker.qixingyue.workers.dev` 替换为您的自定义域名 `geo-sdk.example.com`。

## 常见问题

### Q: 我没有域名怎么办？
A: 您需要购买一个域名，可以从以下渠道购买：
- Cloudflare Registrar（推荐，价格透明）
- 阿里云、腾讯云等国内服务商
- GoDaddy、Namecheap 等国际服务商

### Q: 域名必须在 Cloudflare 吗？
A: 不一定，但推荐将 DNS 服务器指向 Cloudflare，这样配置最简单。如果域名在其他服务商，需要：
1. 在域名服务商处添加 CNAME 记录
2. 指向 `geo-sdk-worker.qixingyue.workers.dev`
3. 但这种方式可能仍然被墙

### Q: 需要备案吗？
A: 如果使用境外服务器（Cloudflare Workers），从技术上讲不需要备案。但如果希望在境内完全合规，建议：
1. 使用已备案的域名
2. 或者使用境内 CDN 加速

### Q: 配置后多久生效？
A: 通常 1-5 分钟。如果超过 10 分钟还未生效，检查：
1. DNS 解析是否正确
2. SSL 证书是否已签发
3. Worker 是否已部署成功

## 推荐域名配置

建议使用子域名，例如：
- `api.example.com`
- `geo.example.com`
- `sdk.example.com`

这样可以：
1. 保持主域名用于其他用途
2. 更灵活地管理不同服务
3. 便于后续扩展

## 下一步

配置好自定义域名后，您的应用就可以在全球范围内访问了，包括中国大陆地区。
