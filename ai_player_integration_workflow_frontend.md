# Frontend - Add AI Player Option

## Step 1: Update Setup Workflow
1. Add a toggle or checkbox in the `startGame` step to enable AI players.
2. Allow users to select which roles will be controlled by AI:
   - Provide a UI element for selecting AI-controlled roles.
   - Ensure the UI prevents invalid configurations (e.g., all roles cannot be AI if at least one human player is required).

3. Add default values for AI player roles:
   - Pre-select default roles for AI players if no selection is made.

---

## Step 2: Pass AI Players to Backend
1. Include the `aiPlayers` array in the API request when starting a game.
2. Ensure the request payload matches the backend's expected format:
   - Validate the `aiPlayers` array before sending the request.
   - Include additional AI-specific properties (e.g., difficulty level) if required by the backend.

3. Handle API errors:
   - Display appropriate error messages if the backend rejects the AI player configuration.

---

## Step 3: Handle AI Moves in Frontend
1. Update the game state after an AI move is made:
   - Ensure the frontend can process and display moves made by AI players.
   - Handle edge cases where the AI move data is delayed or incomplete.

2. Provide visual feedback for AI moves:
   - Highlight the move on the game board.
   - Add animations or effects to distinguish AI moves from human moves.

3. Add error handling for AI move updates:
   - Display a fallback message or retry logic if the AI move fails to update the game state.
