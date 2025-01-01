import Fastify from 'fastify';
import { app } from './app/app';
import ws from '@fastify/websocket';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
});

// Register your application as a normal plugin.
server.register(app);

// Register the WebSocket plugin
server.register(ws);

// Define a WebSocket route
// server.register(async function (fastify) {
//   fastify.get('/*', { websocket: true }, (socket /* WebSocket */, req /* FastifyRequest */) => {
//     socket.on('message', message => {
//       console.log('Received:', message.toString());
//       socket.send('hi from wildcard route')
//     })
//   })
// })

const clients: any = new Set(); // A set to keep track of all connected clients

server.register(async function (fastify) {
  fastify.get('/*', { websocket: true }, (connection /* WebSocket */, req /* FastifyRequest */) => {
    // Add the new connection to the set of clients
    clients.add(connection);
    console.log('Client connected:', clients.size);

    connection.on('message', message => {
      console.log('Received:', message.toString());

      // Broadcast the message to all connected clients
      for (const client of clients) {
        if (client !== connection && client.readyState === client.OPEN) {
          client.send(`Broadcast: ${message}`);
        }
      }
    });

    connection.on('close', () => {
      // Remove the connection from the set on disconnection
      clients.delete(connection);
      console.log('Client disconnected:', clients.size);
    });
  });
});


// Handle connection close
server.addHook('onClose', () => {
  console.log('Client disconnected');
});

// Start listening.
server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    console.log(`[ ready ] http://${host}:${port}`);
  }
});
