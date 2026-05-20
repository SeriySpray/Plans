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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Fetch initial notes
  const { data: initialNotes, error: fetchError } = await supabase
    .from('notes')
    .select('*');

  if (fetchError) {
    console.error('Fetch Error:', fetchError);
  } else {
    console.log(`Sending ${initialNotes?.length || 0} notes to ${socket.id}`);
    socket.emit('init-notes', initialNotes);
  }

  socket.on('add-note', async (note) => {
    console.log('--- ATTEMPTING TO INSERT NOTE ---', note.id);
    
    const noteToSave = {
      id: note.id,
      text: note.text || '',
      x: note.x,
      y: note.y,
      rotation: note.rotation || 0,
      color: note.color,
      width: note.width || 250,
      height: note.height || 250,
      z_index: note.z_index || 1000
    };

    console.log('Payload:', noteToSave);

    const { data, error: insertError } = await supabase
      .from('notes')
      .insert([noteToSave])
      .select();

    if (insertError) {
      console.error('SUPABASE INSERT ERROR:', insertError.message, insertError.details, insertError.hint);
    } else {
      console.log('SUPABASE INSERT SUCCESS. Row count:', data?.length);
    }
    
    // Always broadcast so users see it immediately
    socket.broadcast.emit('note-added', note);
  });

  socket.on('update-note', async (data) => {
    const { id, ...updates } = data;
    
    // Safety: Filter updates to prevent DB errors if client sends extra fields
    const validFields = ['text', 'x', 'y', 'color', 'width', 'height', 'z_index'];
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (validFields.includes(key)) filteredUpdates[key] = updates[key];
    });

    const { error: updateError } = await supabase
      .from('notes')
      .update(filteredUpdates)
      .eq('id', id);

    if (updateError) {
      console.error('Update Error:', updateError);
    }
    
    // Always broadcast update to others for real-time feel
    socket.broadcast.emit('note-updated', data);
  });

  socket.on('delete-note', async (id) => {
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (deleteError) console.error('Delete Error:', deleteError);
    socket.broadcast.emit('note-deleted', id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
