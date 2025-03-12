# Scotland Yard Online

A real-time multiplayer web implementation of the classic deduction board game, built with Nx workspace. One player takes on the role of a fugitive (Mr. X) moving secretly through London while up to 5 detective players work together to track them down.

## Game Features

- **Multiple Player Roles**
  - 1 Culprit (Mr. X) trying to evade capture
  - Up to 5 Detectives working together to catch the culprit
  - Real-time gameplay with turn-based moves

- **Transportation System**
  - Multiple transportation methods:
    - Taxi (short range moves)
    - Bus (medium range moves) 
    - Underground (long range moves)
    - Secret moves and river routes
  - Limited tickets for each transport type
  - Special moves:
    - Double moves for the culprit
    - Secret moves to hide transportation type

## Technical Stack

- Frontend:
  - React with TypeScript
  - Chakra UI for styling
  - WebSocket for real-time communication
  - Zustand for state management
  - i18n for internationalization

- Backend:
  - Fastify server
  - PostgreSQL database (Neon)
  - WebSocket for real-time updates
  - Drizzle ORM

## Getting Started

1. Clone the repository
```bash
git clone git@github.com:waland1510/yard.git
cd yard
```

2. Install dependencies
```bash
bun install
```

3. Set up environment variables

```bash
# apps/frontend/.env.development
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/wss
```

```bash
# apps/backend/.env.development
FRONTEND_URL=http://localhost:4200
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yard
```

4. Development Server
```bash
# Start the frontend development server
npx nx serve frontend

# Start the backend development server
npx nx serve backend
```

5. Build for Production
```bash
# Build frontend
npx nx build frontend

# Build backend
npx nx build backend
```

## Playing the Game

1. Start a new game or join an existing one
2. Choose your role (Culprit or Detective)
3. Use the available transportation methods to move
4. Coordinate with other detectives to catch the culprit
5. Track culprit's revealed positions and deduce their location

