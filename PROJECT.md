# Scotland Yard Game Project Documentation

## Project Overview
A multiplayer implementation of the Scotland Yard board game with AI player support, built using modern web technologies.

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Custom stores using Zustand
- **Websocket**: Custom WebSocket implementation
- **Internationalization**: i18next (supporting en, fr, ja, pl, ua)
- **UI Components**: Chakra UI
- **Testing**: Jest + React Testing Library

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL with Drizzle ORM
- **WebSocket**: @fastify/websocket
- **API Integration**: OpenRouter API for AI (using Deepseek model)
- **Testing**: Jest

### Shared
- **Package Management**: Bun
- **Monorepo Management**: Nx
- **Type Sharing**: shared-utils package
- **Code Quality**: ESLint
- **Testing**: Jest + Playwright for E2E

## Project Structure

### Monorepo Structure
```
/apps
  /backend         # Fastify server
  /backend-e2e     # Backend E2E tests
  /frontend        # React application
  /frontend-e2e    # Frontend E2E tests
/shared-utils      # Shared types and utilities
```

### Key Components

#### Frontend (/apps/frontend)
- **/src/app/game/** - Game-related components
- **/src/app/setup/** - Game setup and player configuration
- **/src/stores/** - State management using Zustand
- **/src/hooks/** - Custom React hooks
- **/src/locales/** - i18n translation files
- **/public/images/** - Game assets and images

#### Backend (/apps/backend)
- **/src/app/helpers/** - Helper functions including AI player logic
- **/src/app/routes/** - API endpoints
- **/src/app/migrations/** - Database migrations
- **/src/app/plugins/** - Fastify plugins

#### Shared Utils (/shared-utils)
- **/src/lib/grid-map.ts** - Game board data structure
  - Defines the complete game map with 200 numbered nodes
  - Each node contains:
    - Unique ID
    - X/Y coordinates for positioning
    - Connected nodes by transportation type (taxi, bus, underground)
    - Special connections (river nodes)
    - Optional flags for secret/double move locations
  - Used by both frontend and backend for move validation
- **/src/lib/shared-utils.ts** - Shared types and utilities

## Key Features

### Game Mechanics
- Turn-based gameplay
- Board Navigation:
  - 200 interconnected nodes representing locations in London
  - Three transportation methods:
    - Taxi (yellow connections, common, short distances)
    - Bus (green connections, medium distances)
    - Underground (red connections, long distances, limited stations)
  - River routes blocking certain paths
  - Connected nodes vary by transportation type
- Special moves (secret, double)
- Real-time updates via WebSocket

### AI Player Support
1. **OpenRouter Integration**
   - Uses Deepseek model for strategic decisions
   - Fallback to local logic when API unavailable

2. **Move Calculation**
   - Distance-based evaluation
   - Strategic ticket usage
   - Escape route analysis for culprit
   - Pursuit optimization for detectives

### Multiplayer
- Real-time game state synchronization
- Player role selection
- Support for AI and human players
- Game state persistence

### Internationalization
Supports multiple languages:
- English (en)
- French (fr)
- Japanese (ja)
- Polish (pl)
- Ukrainian (ua)

## Database Schema

### Tables
1. **games**
   - id (PK)
   - channel
   - players (jsonb)
   - currentTurn
   - moves (jsonb)
   - status
   - isDoubleMove
   - timestamps

2. **players**
   - id (PK)
   - gameId (FK)
   - username
   - role
   - position
   - previousPosition
   - ticket counts (taxi, bus, underground, secret, double)
   - isAI

3. **moves**
   - id (PK)
   - gameId (FK)
   - role
   - type
   - position
   - secret
   - double
   - timestamp

4. **ip_info**
   - id (PK)
   - username
   - location data
   - timestamps

## WebSocket Events

### Event Types
- startGame
- joinGame
- makeMove
- updateGameState
- impersonate
- endGame

## AI Player Implementation

### Decision Making Process
1. Attempt OpenRouter API call for strategic decision
2. Fallback to local logic if API fails:
   - Position evaluation
   - Distance calculations
   - Available moves analysis
   - Ticket optimization
   - Special move consideration

### AI Strategies
- **Culprit**:
  - Maximize distance from detectives
  - Prioritize positions with more escape routes
  - Strategic use of special tickets when cornered

- **Detective**:
  - Minimize distance to culprit
  - Coordinate with other detectives
  - Efficient ticket usage
  - Double move optimization

## Environment Configuration

Required environment variables:
```
OPENROUTER_API_KEY=
DATABASE_URL=
FRONTEND_URL=
HOST=
PORT=
```

## Development Workflow

1. Install dependencies: `bun install`
2. Start development servers:
   - Frontend: `bun nx serve frontend`
   - Backend: `bun nx serve backend`
3. Run tests:
   - Unit tests: `bun nx test`
   - E2E tests: `bun nx e2e`

## Testing Strategy

1. **Unit Tests Only**
   - Frontend component testing with Jest and React Testing Library
   - Backend service and helper function tests
   - AI player logic and move validation
   - Game state management
   - WebSocket handling
   - API endpoint testing
   - Database operations testing
   - Integration tests for critical paths

2. **Test Coverage Focus Areas**
   - Core game mechanics
   - AI player decision making
   - State management
   - WebSocket communication
   - Database operations
   - API endpoints
   - Error handling and edge cases

3. **Running Tests**
   ```
   bun nx test         # Run all unit tests
   bun nx test backend # Run backend tests only
   bun nx test frontend # Run frontend tests only
   ```

Note: We have moved away from Playwright E2E tests in favor of comprehensive unit testing to improve reliability and development speed. Critical user paths are covered through integration tests within the unit testing framework.
