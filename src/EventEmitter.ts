export type EventHandler = (...args: any[]) => void

export interface Events {
	[eventName: string]: Set<EventHandler>
}

export class EventEmitter<T extends string = string> {
	private events: Events = {}

	private getEvents(eventName: T): Set<EventHandler> {
		if (!this.events[eventName]) {
			this.events[eventName] = new Set()
		}

		return this.events[eventName]
	}

	public on(eventName: T, handler: EventHandler) {
		this.getEvents(eventName).add(handler)
	}

	public off(eventName: T, handler: EventHandler) {
		this.getEvents(eventName).delete(handler)
	}

	public once(eventName: T, handler: EventHandler) {
		const onceHandler: EventHandler = (...args: any[]) => {
			this.off(eventName, onceHandler)
			handler(...args)
		}

		this.on(eventName, onceHandler)
	}

	public emit(eventName: T, ...args: unknown[]) {
		this.getEvents(eventName).forEach((handler) => {
			handler(...args)
		})
	}

	public destroy() {
		// this.events = {}

		Object.keys(this.events).forEach((eventName) => {
			this.events[eventName as T].forEach((handler) => {
				this.off(eventName as T, handler)
			})
		})
	}
}
