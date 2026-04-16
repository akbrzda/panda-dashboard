function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const message = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}мс`;

    if (res.statusCode >= 500) {
      console.error(message);
      return;
    }

    console.log(message);
  });

  next();
}

module.exports = requestLogger;
