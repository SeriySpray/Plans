# Minimalist Real-time Collaborative Whiteboard

A simple digital whiteboard where multiple users can add, drag, and edit sticky notes in real-time.

## Features
- **Real-time Sync**: Uses Socket.IO to broadcast changes (add, move, edit) instantly.
- **Persistence**: Uses SQLite to save notes between sessions.
- **Handwritten Style**: Uses 'Caveat' font for a natural look.
- **Interactions**: Double-click to add, drag to move, hover to see delete button.

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript.
- **Backend**: Node.js, Express, Socket.IO.
- **Database**: SQLite3.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Project Structure
- `server.js`: Main backend logic and database management.
- `public/`: Frontend assets.
  - `index.html`: Main page structure.
  - `style.css`: Styling for the board and sticky notes.
  - `script.js`: Frontend logic for real-time interactions.
- `board.db`: SQLite database (created automatically on first run).
