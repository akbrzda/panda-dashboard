/**
 * Простой кеш в памяти с TTL
 */
class Cache {
  constructor() {
    this.store = {};
  }

  /**
   * Сохранить значение с TTL (в миллисекундах)
   */
  set(key, value, ttlMs = 15 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    this.store[key] = { value, expiresAt };
  }

  /**
   * Получить значение из кеша
   */
  get(key) {
    if (!this.store[key]) {
      return null;
    }

    const { value, expiresAt } = this.store[key];

    // Проверить истечение TTL
    if (Date.now() > expiresAt) {
      delete this.store[key];
      return null;
    }

    return value;
  }

  /**
   * Удалить значение
   */
  delete(key) {
    delete this.store[key];
  }

  /**
   * Очистить весь кеш
   */
  clear() {
    this.store = {};
  }

  /**
   * Получить все ключи
   */
  keys() {
    return Object.keys(this.store);
  }
}

module.exports = new Cache();
