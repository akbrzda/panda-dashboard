class ConcurrencyLimiter {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 1);
    this.activeRequests = 0;
    this.queue = [];
  }

  setLimit(value) {
    this.maxConcurrent = Math.max(1, Number(value) || 1);
  }

  async run(task) {
    await new Promise((resolve) => {
      const tryStart = () => {
        if (this.activeRequests < this.maxConcurrent) {
          this.activeRequests += 1;
          resolve();
          return;
        }

        this.queue.push(tryStart);
      };

      tryStart();
    });

    try {
      return await task();
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      const nextTask = this.queue.shift();
      if (typeof nextTask === "function") {
        nextTask();
      }
    }
  }
}

module.exports = ConcurrencyLimiter;
