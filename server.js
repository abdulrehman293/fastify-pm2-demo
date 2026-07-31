const Fastify = require('fastify');
const fastifyWebsocket = require('@fastify/websocket');
const fs = require('fs');
const path = require('path');

const fastify = Fastify({ logger: true });

fastify.register(fastifyWebsocket, {
  options: { maxPayload: 1048576 } 
});

// Serve the HTML dashboard on the root URL
fastify.get('/', (req, reply) => {
  reply.type('text/html').send(fs.createReadStream(path.join(__dirname, 'index.html')));
});

fastify.register(async function (app) {
  app.get('/ws', { websocket: true }, (socket, req) => {
    app.log.info('Client connected to WebSocket stream');

    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    const interval = setInterval(() => {
      if (socket.readyState === 1) { 
        const memoryUsage = process.memoryUsage();
        socket.send(JSON.stringify({
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
        }));
      }
    }, 1000);

    socket.on('close', () => {
      app.log.info('Client disconnected');
      clearInterval(interval);
    });

    socket.on('error', (err) => {
      app.log.error(`Socket error: ${err.message}`);
      clearInterval(interval);
    });
  });
});

const pingInterval = setInterval(() => {
  if (!fastify.websocketServer) return;

  fastify.websocketServer.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

fastify.addHook('onClose', (instance, done) => {
  clearInterval(pingInterval);
  done();
});

const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port: Number(port), host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();