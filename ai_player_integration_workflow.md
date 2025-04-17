# AI Player Integration Workflow

## Step 1: Backend - Add AI Player Support

### Update Game State to Include AI Players
1. Modify the backend game creation logic to accept and store AI players in the `playersTable`.
2. Ensure AI players are identified by a specific flag (e.g., `isAI: true`).

**Example:**
- Add a `isAI` property to the player object when creating a game.
- Store this information in the database.

### Handle AI Moves
1. Use the `aiPlayer.decideMove` function to generate moves for AI players during their turn.
2. Update the `/api/moves` endpoint to:
   - Check if the current player is an AI.
   - Automatically generate a move if it is the AI's turn.

**Example:**
- Call `aiPlayer.decideMove` and update the game state with the generated move.

### Expose AI Player Option in API
1. Update the `/api/games` endpoint to accept an `aiPlayers` array when creating a game.
2. Validate and store this data in the database.

---

## Step 2: Frontend - Add AI Player Option

### Update Setup Workflow
1. Add a toggle or checkbox in the `startGame` step to enable AI players.
2. Allow users to select which roles will be controlled by AI.

**Example:**
- Add a UI element for AI player selection during game setup.

### Pass AI Players to Backend
1. Include the `aiPlayers` array in the API request when starting a game.

**Example:**
- Send the selected AI player roles to the backend via the `/api/games` endpoint.

### Handle AI Moves in Frontend
1. Ensure the frontend can handle moves made by AI players.
2. Update the game state after an AI move is made.

---

## Step 3: Test the Integration

### Test Game Creation
1. Verify that games can be created with AI players.
2. Check that AI players are stored correctly in the database.

### Test AI Moves
1. Ensure AI players make valid moves during their turn.
2. Verify that the game state updates correctly after an AI move.

### Test UI/UX
1. Confirm that the AI toggle and role selection work as expected.
2. Ensure the game flow is smooth for both human and AI players.

---

## Step 4: Optional Enhancements

### AI Difficulty Levels
1. Allow users to select difficulty levels for AI players (e.g., Easy, Medium, Hard).
2. Pass this information to the backend and adjust the AI logic accordingly.

### AI Move Visualization
1. Highlight AI moves on the game board to improve user experience.

### Error Handling
1. Add fallback logic in case the AI service fails (e.g., use `getFallbackMove`).
