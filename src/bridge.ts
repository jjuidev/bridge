import queryString from 'query-string'

import { HttpClient } from './HttpClient'

//
//
export type Id = string | number
export type Filter = Record<string, any>

export interface DefaultService<T> {
	list: (filter: Filter) => Promise<T>
	infinityList: (filter: Filter) => Promise<T>
	detail: (id: Id) => Promise<T>
	create: (data: any) => Promise<T>
	update: ({ id, data }: { id: Id; data: any }) => Promise<T>
	delete: (id: Id) => Promise<T>
	remove: (id: Id) => Promise<T>
	restore: (id: Id) => Promise<T>
}
//

export interface BridgeFactoryOptions {
	httpClient: HttpClient
	qsStrategy?: (qs: Record<string, any>) => string
	queryKeyFactoryFn?: (service: string) => string // Nếu không cung cấp thì dùng default
	serviceFactoryFn?: () => any // Nếu không cung cấp thì dùng default
}

export interface BridgeFactory {
	createQueryKey: (key: string) => string
	createService: (
		resource: string,
		extend?: ({
			httpClient,
			qsStrategy
		}: {
			httpClient: HttpClient
			qsStrategy: (qs: Record<string, any>) => string
		}) => any
	) => any // Định nghĩa type safety default và extend
}

export const createBridgeFactory = (options: BridgeFactoryOptions): BridgeFactory => {
	const { httpClient } = options

	const cleanQs = (qs: Filter) => qs

	const normalizePath = (url: string): string => {
		const [path, qs] = url.split('?')
		const normalized = path?.endsWith('/') ? path : path + '/'

		return qs !== undefined ? `${normalized}?${qs}` : (normalized ?? '')
	}

	const defaultService = (resource: string): DefaultService<T> => ({
		list: (filter) => httpClient.get(`${normalizePath(resource)}?${cleanQs(filter)}`),
		infinityList: (filter) => httpClient.get(`${normalizePath(resource)}?${cleanQs(filter)}`),
		detail: (id) => httpClient.get(`${normalizePath(resource)}${id}`),
		create: (data) => httpClient.post(normalizePath(resource), data),
		update: ({ id, data }) => httpClient.put(`${normalizePath(resource)}${id}`, data),
		delete: (id) => httpClient.delete(`${normalizePath(resource)}${id}`),
		remove: (id) => httpClient.delete(`${normalizePath(resource)}${id}/remove`),
		restore: (id) => httpClient.post(`${normalizePath(resource)}${id}/restore`)
	})

	const createService = (resource: string) => {
		console.log(1)

		return {
			...defaultService(resource),
			...options.serviceFactoryFn?.({
				httpClient,
				qsStrategy: options.qsStrategy ?? ((qs: Record<string, any>) => queryString.stringify(qs))
			})
		}
	}

	const createQueryKey = (key: string) => key

	return {
		createQueryKey,
		createService
	}
}

// Use

const httpClient: any = {}

export const { createQueryKey, createService } = createBridgeFactory({
	httpClient,
	qsStrategy: (qs: Record<string, any>) => queryString.stringify(qs),
	serviceFactoryFn: () => ({
		list: () => httpClient.get('/users'),
		create: (data: any) => httpClient.post('/users', data),
		update: (id: string, data: any) => httpClient.put(`/users/${id}`, data),
		delete: (id: string) => httpClient.delete(`/users/${id}`)
	})
})

// expect use
export const usersService = createService('users') // Mong mốn usersService có sẵn method: list, create, update, delete

export const usersServiceExtend = createService('users', ({ httpClient, qsStrategy }) => ({
	// Mong mốn usersServiceExtend có sẵn method: infinityList
	infinityList: (filter: Filter) => httpClient.get(`/users/infinity-list?${qsStrategy(filter)}`)
}))
