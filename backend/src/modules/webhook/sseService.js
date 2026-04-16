class SseService {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    res.write("event: connected\ndata: {}\n\n");
    this.clients.add(res);

    res.on("close", () => {
      this.clients.delete(res);
    });
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (_) {
        this.clients.delete(client);
      }
    }
  }

  get clientCount() {
    return this.clients.size;
  }
}

module.exports = new SseService();
