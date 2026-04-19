class TTLCache {
	constructor(defaultTtlMs = 0) {
		this.defaultTtlMs = Number(defaultTtlMs) || 0;
		this.store = new Map();
	}

	_resolveExpiresAt(ttlMs) {
		const ttl = Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : this.defaultTtlMs;
		return ttl > 0 ? Date.now() + ttl : Number.POSITIVE_INFINITY;
	}

	_isExpired(entry) {
		return !entry || Number(entry.expiresAt) <= Date.now();
	}

	getEntry(key) {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}

		if (this._isExpired(entry)) {
			this.store.delete(key);
			return null;
		}

		return entry;
	}

	get(key) {
		return this.getEntry(key)?.value ?? null;
	}

	has(key) {
		return this.getEntry(key) !== null;
	}

	set(key, value, ttlMs = this.defaultTtlMs) {
		this.store.set(key, {
			value,
			expiresAt: this._resolveExpiresAt(ttlMs),
			createdAt: Date.now(),
		});

		return value;
	}

	invalidate(key) {
		return this.store.delete(key);
	}

	delete(key) {
		return this.invalidate(key);
	}

	clear() {
		this.store.clear();
	}

	prune() {
		for (const [key, entry] of this.store.entries()) {
			if (this._isExpired(entry)) {
				this.store.delete(key);
			}
		}
	}

	keys() {
		this.prune();
		return [...this.store.keys()];
	}
}

module.exports = new TTLCache(15 * 60 * 1000);
