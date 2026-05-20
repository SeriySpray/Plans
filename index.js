require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file");
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  // Send existing notes to the new user
  const { data: initialNotes, error } = await supabase
    .from('notes')
    .select('*');

  if (error) console.error('Error fetching notes:', error);
  else socket.emit('init-notes', initialNotes);

  socket.on('add-note', async (note) => {
    const { error } = await supabase
      .from('notes')
      .insert([note]);

    if (error) console.error('Error adding note:', error);
    else socket.broadcast.emit('note-added', note);
  });

// Database setup
const db = new sqlite3?.Database ? null : null; // This is a placeholder as we use Supabase now, 
// but I will update the Supabase logic below.

// ... (in the io.on('connection') section)

  socket.on('update-note', async (data) => {
    const { id, ...updates } = data;
    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id);

    if (error) console.error('Error updating note:', error);
    else socket.broadcast.emit('note-updated', data);
  });

  socket.on('delete-note', async (id) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting note:', error);
    else socket.broadcast.emit('note-deleted', id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
