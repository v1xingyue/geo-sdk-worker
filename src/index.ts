/**
 * 地理位置感知的动态 SDK Worker
 * 根据用户所在地区返回不同的 SDK 内容
 */

interface Env {
	API_KEYS: KVNamespace;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const country = request.cf?.country || 'UNKNOWN';

		// 设置 CORS 头
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// 处理 OPTIONS 请求
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// 路由处理
		if (url.pathname === '/sdk.js') {
			return handleSDK(country, corsHeaders);
		} else if (url.pathname === '/api/geo') {
			return handleGeoInfo(request, corsHeaders);
		} else if (url.pathname === '/api/geo-query') {
			return handleGeoQuery(request, corsHeaders);
		} else if (url.pathname === '/api/register') {
			return handleRegister(request, env, country, corsHeaders);
		} else if (url.pathname === '/api/validate') {
			return handleValidate(request, env, corsHeaders);
		} else if (url.pathname === '/api/stats') {
			return handleStats(env, corsHeaders);
		}

		// 其他路径返回 404（静态资源由 assets 处理）
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * 处理 SDK 请求
 */
function handleSDK(country: string, corsHeaders: Record<string, string>): Response {
	const isChinaMainland = country === 'CN';
	const sdkCode = generateSDK(isChinaMainland, country);

	return new Response(sdkCode, {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
			'X-Country': country,
		},
	});
}

/**
 * 处理地理位置信息请求
 */
function handleGeoInfo(request: Request, corsHeaders: Record<string, string>): Response {
	const cf = request.cf;

	// 获取客户端 IP 地址
	const ip = request.headers.get('CF-Connecting-IP') ||
	           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
	           request.headers.get('X-Real-IP') ||
	           'Unknown';

	const geoInfo = {
		// IP 地址信息
		ip: ip,
		ipVersion: ip.includes(':') ? 'IPv6' : 'IPv4',

		// 基本位置信息
		country: cf?.country || 'UNKNOWN',
		countryName: getCountryName(cf?.country as string || 'UNKNOWN'),
		city: cf?.city || 'Unknown',
		region: cf?.region || 'Unknown',
		regionCode: cf?.regionCode || 'Unknown',
		postalCode: cf?.postalCode || 'Unknown',

		// 坐标信息
		latitude: cf?.latitude || 'Unknown',
		longitude: cf?.longitude || 'Unknown',

		// 时区
		timezone: cf?.timezone || 'Unknown',

		// 网络信息
		colo: cf?.colo || 'Unknown', // Cloudflare 数据中心代码
		asn: cf?.asn || 'Unknown', // 自治系统编号
		asOrganization: cf?.asOrganization || 'Unknown',

		// 其他信息
		continent: cf?.continent || 'Unknown',
		metroCode: cf?.metroCode || 'Unknown',

		// 请求时间
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(geoInfo, null, 2), {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

/**
 * 处理IP地址查询请求
 */
async function handleGeoQuery(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
	const url = new URL(request.url);
	const ipParam = url.searchParams.get('ip');

	if (!ipParam) {
		return new Response(
			JSON.stringify({ error: '缺少IP地址参数，请使用 ?ip=xxx.xxx.xxx.xxx' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}

	// 验证IP地址格式（简单验证）
	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
	const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

	if (!ipv4Regex.test(ipParam) && !ipv6Regex.test(ipParam)) {
		return new Response(
			JSON.stringify({ error: 'IP地址格式不正确' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}

	try {
		// 使用 ip-api.com 查询IP地理位置（免费API）
		const apiUrl = `http://ip-api.com/json/${ipParam}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
		const response = await fetch(apiUrl);
		const data = await response.json() as any;

		if (data.status === 'fail') {
			return new Response(
				JSON.stringify({ error: data.message || 'IP地址查询失败' }),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
				}
			);
		}

		// 格式化响应数据
		const geoInfo = {
			// IP 地址信息
			ip: data.query || ipParam,
			ipVersion: ipParam.includes(':') ? 'IPv6' : 'IPv4',

			// 基本位置信息
			country: data.countryCode || 'UNKNOWN',
			countryName: data.country || 'Unknown',
			city: data.city || 'Unknown',
			region: data.regionName || 'Unknown',
			regionCode: data.region || 'Unknown',
			postalCode: data.zip || 'Unknown',

			// 坐标信息
			latitude: data.lat?.toString() || 'Unknown',
			longitude: data.lon?.toString() || 'Unknown',

			// 时区
			timezone: data.timezone || 'Unknown',

			// 网络信息
			asn: data.as?.split(' ')[0]?.replace('AS', '') || 'Unknown',
			asOrganization: data.isp || data.org || 'Unknown',
			isp: data.isp || 'Unknown',
			org: data.org || 'Unknown',

			// 其他信息
			continent: data.continentCode || 'Unknown',
			continentName: data.continent || 'Unknown',

			// 请求时间
			timestamp: new Date().toISOString(),
		};

		return new Response(JSON.stringify(geoInfo, null, 2), {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json; charset=utf-8',
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'IP地址查询失败，请稍后重试' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}
}

/**
 * 获取国家中文名称
 */
function getCountryName(code: string): string {
	const countryNames: Record<string, string> = {
		'CN': '中国',
		'US': '美国',
		'JP': '日本',
		'KR': '韩国',
		'GB': '英国',
		'FR': '法国',
		'DE': '德国',
		'CA': '加拿大',
		'AU': '澳大利亚',
		'SG': '新加坡',
		'HK': '香港',
		'TW': '台湾',
		'UNKNOWN': '未知',
	};
	return countryNames[code] || code;
}

/**
 * 处理 API Key 申请
 */
async function handleRegister(
	request: Request,
	env: Env,
	country: string,
	corsHeaders: Record<string, string>
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json() as { appName?: string; email?: string };
		const appName = body.appName || 'Unnamed App';
		const email = body.email || '';

		// 生成唯一的 App ID 和 API Key
		const appId = generateAppId();
		const apiKey = generateApiKey();

		// 存储到 KV
		const apiKeyData = {
			appId,
			apiKey,
			appName,
			email,
			country,
			createdAt: new Date().toISOString(),
			usageCount: 0,
		};

		await env.API_KEYS.put(appId, JSON.stringify(apiKeyData));
		await env.API_KEYS.put(`key_${apiKey}`, appId); // 反向索引

		return new Response(
			JSON.stringify({
				success: true,
				appId,
				apiKey,
				message: 'API Key 创建成功',
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Invalid request body' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 验证 API Key
 */
async function handleValidate(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json() as { appId?: string; apiKey?: string };
		const { appId, apiKey } = body;

		if (!appId || !apiKey) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Missing appId or apiKey' }),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		// 从 KV 获取数据
		const dataStr = await env.API_KEYS.get(appId);
		if (!dataStr) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Invalid appId' }),
				{
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		const data = JSON.parse(dataStr);
		if (data.apiKey !== apiKey) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Invalid apiKey' }),
				{
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		// 更新使用次数
		data.usageCount = (data.usageCount || 0) + 1;
		data.lastUsedAt = new Date().toISOString();
		await env.API_KEYS.put(appId, JSON.stringify(data));

		return new Response(
			JSON.stringify({ valid: true, appName: data.appName, usageCount: data.usageCount }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Invalid request body' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 获取统计信息
 */
async function handleStats(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		const keys = await env.API_KEYS.list({ prefix: 'app_' });
		const totalApps = keys.keys.length;

		return new Response(
			JSON.stringify({
				totalRegistrations: totalApps,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Failed to fetch stats' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 生成 App ID
 */
function generateAppId(): string {
	return 'app_' + generateRandomString(24);
}

/**
 * 生成 API Key
 */
function generateApiKey(): string {
	return 'sk_' + generateRandomString(32);
}

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);
	for (let i = 0; i < length; i++) {
		result += chars[randomValues[i] % chars.length];
	}
	return result;
}

/**
 * 生成动态 SDK 代码
 */
function generateSDK(isChinaMainland: boolean, country: string): string {
	if (isChinaMainland) {
		// 境内用户返回拒绝访问的 SDK
		return `
(function() {
  'use strict';

  // SDK 版本
  const SDK_VERSION = '1.0.0';
  const USER_COUNTRY = '${country}';
  const API_BASE_URL = window.location.origin;

  // 境内用户提示
  console.warn('[SDK] 检测到您来自中国境内，应用暂时拒绝访问');

  // 创建全局 SDK 对象
  window.MySDK = {
    version: SDK_VERSION,
    country: USER_COUNTRY,
    available: false,
    message: '应用暂时拒绝访问',

    init: function(config) {
      console.error('[SDK] 应用暂不支持中国境内访问');
      return {
        success: false,
        error: '应用暂时拒绝访问',
        country: USER_COUNTRY
      };
    },

    // 所有方法都返回不可用状态
    call: function() {
      throw new Error('SDK 不可用：应用暂时拒绝访问');
    }
  };

  console.info('[SDK] v' + SDK_VERSION + ' 已加载（受限模式）');
})();
`.trim();
	} else {
		// 境外用户返回正常的 SDK
		return `
(function() {
  'use strict';

  // SDK 版本
  const SDK_VERSION = '1.0.0';
  const USER_COUNTRY = '${country}';
  const API_BASE_URL = window.location.origin;

  console.info('[SDK] 欢迎使用，您的位置：' + USER_COUNTRY);

  // 创建全局 SDK 对象
  window.MySDK = {
    version: SDK_VERSION,
    country: USER_COUNTRY,
    available: true,
    config: null,

    // 初始化方法
    init: function(config) {
      console.log('[SDK] 正在初始化...', config);
      this.config = config || {};

      // 验证 API Key（可选）
      if (config.appId && config.apiKey) {
        return this.validateCredentials(config.appId, config.apiKey);
      }

      return Promise.resolve({
        success: true,
        country: USER_COUNTRY,
        message: '初始化成功（未验证 API Key）'
      });
    },

    // 验证凭证
    validateCredentials: function(appId, apiKey) {
      return fetch(API_BASE_URL + '/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appId: appId, apiKey: apiKey })
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.valid) {
          console.log('[SDK] API Key 验证成功');
          return {
            success: true,
            country: USER_COUNTRY,
            appName: data.appName,
            usageCount: data.usageCount
          };
        } else {
          console.error('[SDK] API Key 验证失败:', data.error);
          return {
            success: false,
            error: data.error
          };
        }
      })
      .catch(function(error) {
        console.error('[SDK] 验证请求失败:', error);
        return {
          success: false,
          error: '网络请求失败'
        };
      });
    },

    // API 调用方法
    call: function(endpoint, data) {
      console.log('[SDK] 调用 API:', endpoint, data);

      var headers = {
        'Content-Type': 'application/json',
        'X-SDK-Version': SDK_VERSION,
        'X-Country': USER_COUNTRY
      };

      // 添加认证头
      if (this.config && this.config.appId && this.config.apiKey) {
        headers['X-App-ID'] = this.config.appId;
        headers['X-API-Key'] = this.config.apiKey;
      }

      return fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      }).then(function(response) {
        return response.json();
      });
    },

    // 获取用户信息
    getUserInfo: function() {
      return {
        country: USER_COUNTRY,
        timestamp: new Date().toISOString(),
        version: SDK_VERSION
      };
    },

    // 注册新的 API Key
    register: function(appName, email) {
      return fetch(API_BASE_URL + '/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appName: appName, email: email })
      })
      .then(function(response) {
        return response.json();
      });
    }
  };

  console.info('[SDK] v' + SDK_VERSION + ' 已成功加载');
})();
`.trim();
	}
}
