import { jwtDecode } from 'jwt-decode'

import { EventEmitter } from './EventEmitter'

export type TokenKey = {
	accessToken: string
	refreshToken: string
}
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

	tokenKey?: TokenKey
	expiryThreshold?: number // ms
}

export class TokenManager extends EventEmitter<RefreshTokenEvents> implements ITokenManager {
	private isRefreshing = false
	private refreshPromise: Promise<void> | null = null

	private readonly _tokenKey: TokenKey
	private readonly expiryThreshold: number

	constructor(private readonly options: TokenManagerOptions) {
		super()

		this._tokenKey = {
			accessToken: 'accessToken',
			refreshToken: 'refreshToken',
			...options.tokenKey
		}
		this.expiryThreshold = options.expiryThreshold ?? 60_000

		this.setupEventListener()
	}

	get tokenKey(): TokenKey {
		return this._tokenKey
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

	public getAccessToken(): string {
		if (this.options.getAccessToken) {
			return this.options.getAccessToken()
		}

		const accessToken = localStorage.getItem(this.tokenKey.accessToken)

		if (!accessToken) {
			const error = new Error('No access token available')

			this.emit('token:invalid', error)
			throw error
		}

		return accessToken
	}

	public getRefreshToken(): string {
		if (this.options.getRefreshToken) {
			return this.options.getRefreshToken()
		}

		const refreshToken = localStorage.getItem(this.tokenKey.refreshToken)

		if (!refreshToken) {
			const error = new Error('No refresh token available')

			this.emit('token:invalid', error)
			throw error
		}

		return refreshToken
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

	private setupEventListener() {
		const handleTokenInvalid = (error: any) => {
			if (this.options.onTokenInvalid) {
				this.options.onTokenInvalid(error)
			} else {
				localStorage.clear()
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
				localStorage.setItem(this.tokenKey.accessToken, newToken.accessToken)
				localStorage.setItem(this.tokenKey.refreshToken, newToken.refreshToken)
			}
		}

		const handleRefreshTokenError = (error: any) => {
			if (this.options.onRefreshTokenError) {
				this.options.onRefreshTokenError(error)
			} else {
				localStorage.clear()
			}
		}

		const handleRefreshTokenExpired = (error: any) => {
			if (this.options.onRefreshTokenExpired) {
				this.options.onRefreshTokenExpired(error)
			} else {
				localStorage.clear()
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
