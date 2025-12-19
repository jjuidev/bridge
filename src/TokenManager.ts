import { jwtDecode } from 'jwt-decode'

import { EventEmitter } from './EventEmitter'

export type Token = {
	accessToken: string
	refreshToken: string
}

export type RefreshTokenEvents =
	| 'token:invalid'
	| 'refreshToken:start'
	| 'refreshToken:success'
	| 'refreshToken:error'
	| 'refreshToken:expired'

export interface ITokenManager {
	getToken: () => Promise<string>
}

export interface TokenManagerOptions {
	getAccessToken?: () => string
	getRefreshToken?: () => string
	isAccessTokenExpired?: (token: string) => boolean
	isRefreshTokenExpired?: (token: string) => boolean

	executeRefreshToken: (currentToken: Token) => Promise<Token>
	onTokenInvalid?: (error: any) => void
	onRefreshTokenStart?: () => void
	onRefreshTokenSuccess?: (newToken: Token) => void
	onRefreshTokenError?: (error: any) => void
	onRefreshTokenExpired?: (error: any) => void
	expiryThreshold?: number // ms
}

export class TokenManager extends EventEmitter<RefreshTokenEvents> implements ITokenManager {
	private isRefreshing = false
	private refreshPromise: Promise<void> | null = null

	private readonly tokenKey = {
		accessToken: 'accessToken',
		refreshToken: 'refreshToken'
	}
	private expiryThreshold: number = 60_000 // milliseconds

	constructor(private readonly options: TokenManagerOptions) {
		super()

		if (options.expiryThreshold) {
			this.expiryThreshold = options.expiryThreshold
		}

		this.addEventListener()
	}

	private isTokenExpired(token: string): boolean {
		try {
			const decoded = jwtDecode(token)

			if (!decoded.exp) {
				return false
			}

			return decoded.exp * 1_000 < Date.now() + this.expiryThreshold
		} catch (error) {
			this.emit('token:invalid', error)
			throw error
		}
	}

	private getTokenFromStorage(): Token {
		const accessToken = localStorage.getItem(this.tokenKey.accessToken)
		const refreshToken = localStorage.getItem(this.tokenKey.refreshToken)

		if (!accessToken || !refreshToken) {
			const error = new Error('No access or refresh token available')

			this.emit('token:invalid', error)
			throw error
		}

		return {
			accessToken,
			refreshToken
		}
	}

	private setTokenToStorage(token: Token) {
		Object.entries(token).forEach(([key, value]) => {
			localStorage.setItem(this.tokenKey[key as 'accessToken' | 'refreshToken'], value)
		})
	}

	private clearTokenFromStorage() {
		Object.keys(this.tokenKey).forEach((key) => {
			localStorage.removeItem(key)
		})
	}

	public getAccessToken(): string {
		if (this.options.getAccessToken) {
			return this.options.getAccessToken()
		}

		return this.getTokenFromStorage().accessToken
	}

	public getRefreshToken(): string {
		if (this.options.getRefreshToken) {
			return this.options.getRefreshToken()
		}

		return this.getTokenFromStorage().refreshToken
	}

	public isAccessTokenExpired(): boolean {
		const accessToken = this.getAccessToken()

		if (this.options.isAccessTokenExpired) {
			return this.options.isAccessTokenExpired(accessToken)
		}

		return this.isTokenExpired(accessToken)
	}

	public isRefreshTokenExpired(): boolean {
		const refreshToken = this.getRefreshToken()

		if (this.options.isRefreshTokenExpired) {
			return this.options.isRefreshTokenExpired(refreshToken)
		}

		return this.isTokenExpired(refreshToken)
	}

	public async refreshTokenIfNecessary(): Promise<void> {
		if (this.isRefreshing) {
			return this.refreshPromise!
		}

		if (this.isRefreshTokenExpired()) {
			const error = new Error('refreshToken expired')

			this.emit('refreshToken:expired', error)
			throw error
		}

		this.isRefreshing = true
		this.emit('refreshToken:start')

		this.refreshPromise = (async () => {
			try {
				const currentToken = {
					accessToken: this.getAccessToken(),
					refreshToken: this.getRefreshToken()
				}

				const newToken = await this.options.executeRefreshToken(currentToken)

				if (!newToken?.accessToken || !newToken?.refreshToken) {
					const error = new Error('Invalid token returned from executeRefreshToken')

					this.emit('refreshToken:error', error)
					throw error
				}

				this.emit('refreshToken:success', {
					accessToken: newToken.accessToken,
					refreshToken: newToken.refreshToken
				})
			} catch (error) {
				this.emit('refreshToken:error', error)
				throw error
			} finally {
				this.isRefreshing = false
				this.refreshPromise = null
			}
		})()

		return this.refreshPromise
	}

	private addEventListener() {
		const handleTokenInvalid = (error: any) => {
			if (this.options.onTokenInvalid) {
				this.options.onTokenInvalid(error)
			} else {
				this.clearTokenFromStorage()
			}
		}

		const handleRefreshTokenStart = () => {
			if (this.options.onRefreshTokenStart) {
				this.options.onRefreshTokenStart()
			}
		}

		const handleRefreshTokenSuccess = (newToken: Token) => {
			if (this.options.onRefreshTokenSuccess) {
				this.options.onRefreshTokenSuccess(newToken)
			} else {
				this.setTokenToStorage(newToken)
			}
		}

		const handleRefreshTokenError = (error: any) => {
			if (this.options.onRefreshTokenError) {
				this.options.onRefreshTokenError(error)
			} else {
				this.clearTokenFromStorage()
			}
		}

		const handleRefreshTokenExpired = (error: any) => {
			if (this.options.onRefreshTokenExpired) {
				this.options.onRefreshTokenExpired(error)
			} else {
				this.clearTokenFromStorage()
			}
		}

		this.on('token:invalid', handleTokenInvalid)
		this.on('refreshToken:start', handleRefreshTokenStart)
		this.on('refreshToken:success', handleRefreshTokenSuccess)
		this.on('refreshToken:error', handleRefreshTokenError)
		this.on('refreshToken:expired', handleRefreshTokenExpired)
	}

	public async getToken(): Promise<string> {
		if (this.isAccessTokenExpired()) {
			await this.refreshTokenIfNecessary()
		}

		return this.getAccessToken()
	}
}
