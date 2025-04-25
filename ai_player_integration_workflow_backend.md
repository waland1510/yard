# Backend - Add AI Player Support

## Step 1: Update Game State to Include AI Players
1. Modify the game creation logic to accept AI players:
   - Add a `isAI` property to the player object.
   - Store this information in the `playersTable` or equivalent database table.

2. Validate AI player data:
   - Ensure the `isAI` flag is properly set for AI players.
   - Check for invalid or conflicting configurations (e.g., a player cannot be both human and AI).

3. Define default properties for AI players:
   - Assign default values for properties like name and difficulty level if not provided.

4. Update the database schema:
   - Ensure the schema supports storing the `isAI` flag and any additional AI-specific properties.

5. Ensure backward compatibility:
   - Verify that existing games without AI players are not affected by the changes.

6. Handle mixed player types:
   - Ensure the game state supports games with both human and AI players.

---

## Step 2: Handle AI Moves
1. Implement logic to handle AI turns:
   - Use the `aiPlayer.decideMove` function to generate moves for AI players.
   - Update the game state with the generated move.

2. Update the `/api/moves` endpoint:
   - Check if the current player is an AI.
   - Automatically generate and apply a move if it is the AI's turn.
   - Ensure proper error handling if the AI move generation fails (e.g., fallback to a default move).

3. Add logging for AI moves:
   - Log AI decisions for debugging and analytics purposes.

---

## Step 3: Expose AI Player Option in API
1. Update the `/api/games` endpoint:
   - Accept an `aiPlayers` array when creating a game.
   - Validate the `aiPlayers` data and store it in the database.
   - Ensure the `aiPlayers` array does not conflict with human player configurations.

2. Ensure the API can handle requests with AI player configurations:
   - Add appropriate error messages for invalid AI player data.
   - Test the endpoint with various configurations (e.g., all AI players, mixed players, no AI players).
