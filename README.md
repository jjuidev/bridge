# @jjuidev/bridge

Modern TypeScript HTTP client built on axios with token management. Supports event-driven refresh token flow.

## Features

- Inject token to request headers.
- Event-driven refresh token flow.
- Default logic base on axios, localStorage and jwt-decode.
- Easy to use and configure for authentication refresh token flow.

## Installation

```bash
# npm
npm install @jjuidev/bridge

# yarn
yarn add @jjuidev/bridge

# pnpm
pnpm add @jjuidev/bridge

# bun
bun add @jjuidev/bridge
```

## Basic Usage

```typescript
import { HttpClient } from '@jjuidev/bridge'

const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		ignoreTokenPatterns: [/\/auth\/login/],
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		}
	}
})
```

## Interceptors

### Single Request Interceptor

```typescript
httpClient.useRequestInterceptor({
	onRequest: (config) => {
		console.log('Request:', config.url)
		config.headers['X-Request-ID'] = crypto.randomUUID()
		return config
	},
	onRequestError: (error) => {
		console.error('Request error:', error)
		return Promise.reject(error)
	}
})
```

### Multiple Response Interceptors

```typescript
httpClient.useResponseInterceptor([
	{
		onResponse: (response) => {
			console.log('Status:', response.status)
			return response
		}
	},
	{
		onResponse: (response) => {
			return response.data
		}
	}
])
```

## Token Management

### ⚠️ Important: Refresh Token API Call

**DO NOT use `httpClient` to call refresh token API** - This will cause an infinite loop!

**Why?**

```
httpClient.post('/auth/refresh')
  → Interceptor checks token → getToken()
  → Token expired → refreshTokenIfNecessary()
  → executeRefreshToken() → httpClient.post('/auth/refresh') again
  → INFINITE LOOP! 🔄
```

**✅ Correct Approach: Use `fetch` directly**

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		}
	}
})
```

### Custom source of token (getAccessToken and getRefreshToken)

By default, the library will get accessToken and refreshToken from localStorage. You can define your own logic to get accessToken and refreshToken from sessionStorage, cookie, etc.

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		getAccessToken: () => sessionStorage.getItem('token_access') ?? '',
		getRefreshToken: () => sessionStorage.getItem('token_refresh') ?? '',
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		}
	}
})
```

### Token events callbacks

By default, the library will `set|clear` token `to|from` `localStorage` for the token events. You can define your own logic to handle the token events.

| Token event            | Default behavior |
| ---------------------- | ---------------- |
| `token:invalid`        | clear            |
| `refreshToken:start`   | \_               |
| `refreshToken:success` | set              |
| `refreshToken:error`   | clear            |
| `refreshToken:expired` | clear            |

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		},
		onTokenInvalid: (error) => {
			// Handle invalid token (e.g., redirect to login)
		},
		onRefreshTokenStart: () => {
			// Handle refresh token start if necessary
		},
		onRefreshTokenSuccess: (newToken) => {
			// Handle refresh token (e.g., update token in localStorage)
		},
		onRefreshTokenError: (error) => {
			// Handle refresh error (e.g., redirect to login)
		},
		onRefreshTokenExpired: (error) => {
			// Handle expired refresh token (e.g., redirect to login)
		}
	}
})
```

### Custom token validation (isAccessTokenExpired and isRefreshTokenExpired)

By default, the library will use JWT decode to check token `exp` with `expiryThreshold` (1 minute by default). You can define your own logic to check if access token or refresh token is expired.

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		isAccessTokenExpired: (token) => {
			// Custom logic to check if access token is expired
			// Return true if expired, false if valid
			return false
		},
		isRefreshTokenExpired: (token) => {
			// Custom logic to check if refresh token is expired
			// Return true if expired, false if valid
			return false
		},
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		}
	}
})
```

## Ignore Token Patterns

By default, token is automatically attached to all requests. Use `ignoreTokenPatterns` to skip token attachment for specific routes (e.g., public endpoints, login, register)

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	ignoreTokenPatterns: [/\/auth\/login/, /\/auth\/register/, /\/public\//],
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()
			return data.data
		}
	}
})
```

## Custom auth injection (injectAuth)

By default, token is automatically injected as `Authorization: Bearer ${token}` header. Use `injectAuth` to customize how the token is attached to requests (header name, format, query params, etc.)

### Default Behavior (Bearer Token)

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	// Default: request.headers['Authorization'] = `Bearer ${token}`
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			// ... refresh logic
		}
	}
})
```

### Custom Auth Type

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	injectAuth: (token, request) => {
		// Custom auth type, example: X-Auth-Token
		request.headers['X-Auth-Token'] = token
	},
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			// ... refresh logic
		}
	}
})
```

## Token Refresh Flow

```
// Flow refreshToken by Event-Driven Architecture
Request → getToken() → isAccessTokenExpired()? → No Token/Invalid? → Emit 'token:invalid' → throw
                              ↓
                  refreshTokenIfNecessary()
                              ↓
                    Already Refreshing? → Wait (Single-Flight)
                              ↓
                    isRefreshTokenExpired()? → No Token/Invalid? → Emit 'token:invalid' → throw
                              ↓
                    Emit 'refreshToken:start' → executeRefreshToken()
                                                          ↓
                                                      Success? -> Emit 'refreshToken:error' → throw
                                                          ↓
                                              Emit 'refreshToken:success'
                                                          ↓
                                                    getAccessToken() - (after onRefreshTokenSuccess)
```

### Token refresh flow events

| Token event            | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `token:invalid`        | Emitted when token is `missing`, `invalid`, or `cannot be decoded` |
| `refreshToken:start`   | Emitted when refresh process begins                                |
| `refreshToken:success` | Emitted when refresh succeeds (includes new token object)          |
| `refreshToken:error`   | Emitted when refresh API call fails                                |
| `refreshToken:expired` | Emitted when refreshToken is `expired`                             |

## Author

**jjuidev**

- Email: hi@jjuidev.com
- GitHub: [jjuidev](https://github.com/jjuidev)

## License

MIT
