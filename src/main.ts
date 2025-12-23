import { createBridgeFactory, Filter } from './bridge'
import { HttpClient } from './HttpClient'

export * from './HttpClient'
export * from './TokenManager'
export * from './EventEmitter'
export * from './bridge'

//
const API_BASE_URL = 'https://api.jjuidev.com'

export const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json'
	},
	ignoreTokenPatterns: [/auth\/login/],
	tokenManagerOptions: {
		expiryThreshold: 10_000,
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

httpClient.useResponseInterceptor({
	onResponse: async (response) => response.data,
	onResponseError: async (error) => Promise.reject(error)
})

export const { createQueryKey, createService } = createBridgeFactory({ httpClient })

export const authQueryKey = createQueryKey('auth', ({ buildQueryKey }) => ({
	list23: (filter?: Filter) => buildQueryKey(filter)
}))
