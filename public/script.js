const socket = io();
const board = document.getElementById('board');
const notes = new Map();

const NOTE_COLORS = [
    '#fdfd96', // Yellow
    '#ff9999', // Pink
    '#99ff99', // Green
    '#99ccff', // Blue
    '#ffcc99'  // Orange
];

// Helper to create a note element
function createNoteElement(id, text, x, y, rotation, color) {
    const noteEl = document.createElement('div');
    noteEl.className = 'sticky-note';
    noteEl.id = id;
    noteEl.style.left = `${x}px`;
    noteEl.style.top = `${y}px`;
    noteEl.style.transform = `rotate(${rotation}deg)`;
    noteEl.style.backgroundColor = color || NOTE_COLORS[0];

    const textarea = document.createElement('textarea');
    textarea.value = text || '';
    textarea.placeholder = 'Type here...';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        socket.emit('delete-note', id);
        removeNote(id);
    };

    // Color picker
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    NOTE_COLORS.forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.backgroundColor = c;
        dot.onclick = (e) => {
            e.stopPropagation();
            noteEl.style.backgroundColor = c;
            socket.emit('update-note', { id, color: c });
        };
        colorPicker.appendChild(dot);
    });

    noteEl.appendChild(deleteBtn);
    noteEl.appendChild(colorPicker);
    noteEl.appendChild(textarea);
    board.appendChild(noteEl);

    // Dragging logic
    let isDragging = false;
    let startX, startY;

    noteEl.addEventListener('mousedown', (e) => {
        if (e.target === textarea || e.target === deleteBtn || e.target.classList.contains('color-dot')) return;
        isDragging = true;
        startX = e.clientX - noteEl.offsetLeft;
        startY = e.clientY - noteEl.offsetTop;
        noteEl.style.zIndex = 1000;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newX = e.clientX - startX;
        const newY = e.clientY - startY;
        
        noteEl.style.left = `${newX}px`;
        noteEl.style.top = `${newY}px`;

        socket.emit('update-note', { id, x: newX, y: newY });
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            noteEl.style.zIndex = '';
        }
    });

    // Sync text changes
    textarea.addEventListener('input', () => {
        socket.emit('update-note', { id, text: textarea.value });
    });

    return { noteEl, textarea };
}

function removeNote(id) {
    const note = notes.get(id);
    if (note) {
        note.noteEl.remove();
        notes.delete(id);
    }
}

// Socket events
socket.on('init-notes', (initialNotes) => {
    initialNotes.forEach(note => {
        const { id, text, x, y, rotation, color } = note;
        const elements = createNoteElement(id, text, x, y, rotation, color);
        notes.set(id, elements);
    });
});

socket.on('note-added', (note) => {
    const { id, text, x, y, rotation, color } = note;
    if (!notes.has(id)) {
        const elements = createNoteElement(id, text, x, y, rotation, color);
        notes.set(id, elements);
    }
});

socket.on('note-updated', (data) => {
    const note = notes.get(data.id);
    if (note) {
        if (data.x !== undefined && data.y !== undefined) {
            note.noteEl.style.left = `${data.x}px`;
            note.noteEl.style.top = `${data.y}px`;
        }
        if (data.text !== undefined) {
            note.textarea.value = data.text;
        }
        if (data.color !== undefined) {
            note.noteEl.style.backgroundColor = data.color;
        }
    }
});

socket.on('note-deleted', (id) => {
    removeNote(id);
});

// Create note on double click
board.addEventListener('dblclick', (e) => {
    if (e.target !== board) return;

    const id = crypto.randomUUID();
    const x = e.clientX - 90; // center on cursor (half width)
    const y = e.clientY - 90; // center on cursor (half height)
    const rotation = Math.random() * 4 - 2; // -2 to 2 degrees
    const color = NOTE_COLORS[0];
    const text = '';

    const elements = createNoteElement(id, text, x, y, rotation, color);
    notes.set(id, elements);

    socket.emit('add-note', { id, text, x, y, rotation, color });
    
    // Focus the new note
    elements.textarea.focus();
});
