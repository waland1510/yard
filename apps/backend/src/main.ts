import Fastify from 'fastify';
import { app } from './app/app';
import ws from '@fastify/websocket';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const server = Fastify();

interface Message {
  type: string;
  channel?: string;
  data: any;
}

let gameState = {
  players: [],
  gameMode: 'easy',
  channel: '',
};

console.log('gameState', gameState);


const channels: Record<string, Set<any>> = {};

server.register(app);
server.register(ws);

server.register(async function (fastify) {
  fastify.get(
    '/*',
    { websocket: true },
    (connection /* WebSocket */, req /* FastifyRequest */) => {
      let currentChannel: string | null = null;

      connection.on('message', (message) => {
        const parsedMessage: Message = JSON.parse(message.toString());
        console.log('Received:', parsedMessage);
        switch (parsedMessage.type) {
          case 'startGame':
            currentChannel = parsedMessage.channel;
            channels[currentChannel] = new Set();
            channels[currentChannel].add(connection);
            console.log(`Client joined channel: ${currentChannel}`);
            break;

          case 'joinGame':
            currentChannel = parsedMessage.channel;
            if (!channels[currentChannel]) {
              channels[currentChannel] = new Set();
            }
            channels[currentChannel].add(connection);
            console.log(`Client joined channel: ${currentChannel}`);
            console.log('Client joined channel:',{gameState});

            broadcast(currentChannel, {
              type: 'updateGameState',
              data: gameState,
            });
            break;

          case 'updateGameState':
            if (currentChannel) {
              gameState.players = parsedMessage.data.players;
              // broadcast(currentChannel, {
              //   type: 'updateGameState',
              //   data: parsedMessage.data,
              // });
            }
            break;

          case 'makeMove':
            if (currentChannel) {
              broadcast( currentChannel, {
                
                type: 'makeMove',
                data: parsedMessage.data,
              });
            }
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      });

      connection.on('close', () => {
        if (currentChannel && channels[currentChannel]) {
          channels[currentChannel].delete(connection);
          console.log(
            `Client disconnected from channel: ${currentChannel}. Remaining clients: ${channels[currentChannel].size}`
          );

          // Clean up the channel if empty
          if (channels[currentChannel].size === 0) {
            delete channels[currentChannel];
            console.log(`Channel ${currentChannel} deleted`);
          }
        }
      });
    }
  );
});

const broadcast = (channel: string, message: Message) => {
  const clients = channels[channel];
  if (clients) {
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }
};

server.listen({ port, host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
