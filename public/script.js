const socket = io();
const board = document.getElementById('board');
const addNoteBtn = document.getElementById('add-note-btn');
const notes = new Map();

const NOTE_COLORS = [
    '#fdfd96', // Yellow
    '#ff9999', // Pink
    '#99ff99', // Green
    '#99ccff', // Blue
    '#ffcc99'  // Orange
];

// Center view on start
window.scrollTo(2500 - window.innerWidth / 2, 2500 - window.innerHeight / 2);

// Helper to create a note element
function createNoteElement(id, text, x, y, rotation, color, width, height) {
    const noteEl = document.createElement('div');
    noteEl.className = 'sticky-note';
    noteEl.id = id;
    noteEl.style.left = `${x}px`;
    noteEl.style.top = `${y}px`;
    noteEl.style.width = `${width || 250}px`;
    noteEl.style.height = `${height || 250}px`;
    noteEl.style.transform = `rotate(${rotation}deg)`;
    noteEl.style.backgroundColor = color || NOTE_COLORS[0];

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';

    const textarea = document.createElement('textarea');
    textarea.value = text || '';
    textarea.placeholder = 'Type...';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.ontouchstart = deleteBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        socket.emit('delete-note', id);
        removeNote(id);
    };

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

    // Color picker
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker';
    NOTE_COLORS.forEach(c => {
        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.backgroundColor = c;
        dot.ontouchstart = dot.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            noteEl.style.backgroundColor = c;
            socket.emit('update-note', { id, color: c });
        };
        colorPicker.appendChild(dot);
    });

    noteEl.appendChild(dragHandle);
    noteEl.appendChild(deleteBtn);
    noteEl.appendChild(resizeHandle);
    noteEl.appendChild(colorPicker);
    noteEl.appendChild(textarea);
    board.appendChild(noteEl);

    // Interaction State
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const onStart = (e) => {
        const isResizeAction = e.target === resizeHandle;
        const isDragAction = e.target === dragHandle;
        
        if (!isDragAction && !isResizeAction) return;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        if (isResizeAction) {
            isResizing = true;
            startWidth = parseInt(document.defaultView.getComputedStyle(noteEl).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(noteEl).height, 10);
            startX = clientX;
            startY = clientY;
        } else {
            isDragging = true;
            startX = clientX - noteEl.offsetLeft + window.scrollX;
            startY = clientY - noteEl.offsetTop + window.scrollY;
        }
        
        noteEl.style.zIndex = 1000;
        noteEl.classList.add('active');
        if (e.cancelable) e.preventDefault(); 
    };

    const onMove = (e) => {
        if (!isDragging && !isResizing) return;
        
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        if (isResizing) {
            const newWidth = Math.max(150, startWidth + (clientX - startX));
            const newHeight = Math.max(150, startHeight + (clientY - startY));
            noteEl.style.width = `${newWidth}px`;
            noteEl.style.height = `${newHeight}px`;
            socket.emit('update-note', { id, width: newWidth, height: newHeight });
        } else if (isDragging) {
            const newX = clientX - startX + window.scrollX;
            const newY = clientY - startY + window.scrollY;
            noteEl.style.left = `${newX}px`;
            noteEl.style.top = `${newY}px`;
            socket.emit('update-note', { id, x: newX, y: newY });
        }
        if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            noteEl.style.zIndex = '';
            noteEl.classList.remove('active');
        }
    };

    noteEl.addEventListener('mousedown', onStart);
    noteEl.addEventListener('touchstart', onStart, { passive: false });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });

    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

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
        const { id, text, x, y, rotation, color, width, height } = note;
        const elements = createNoteElement(id, text, x, y, rotation, color, width, height);
        notes.set(id, elements);
    });
});

socket.on('note-added', (note) => {
    const { id, text, x, y, rotation, color, width, height } = note;
    if (!notes.has(id)) {
        const elements = createNoteElement(id, text, x, y, rotation, color, width, height);
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
        if (data.width !== undefined && data.height !== undefined) {
            note.noteEl.style.width = `${data.width}px`;
            note.noteEl.style.height = `${data.height}px`;
        }
    }
});

socket.on('note-deleted', (id) => {
    removeNote(id);
});

// Helper to add note
function addNoteAt(clientX, clientY) {
    const id = crypto.randomUUID();
    const x = clientX + window.scrollX - 125; 
    const y = clientY + window.scrollY - 125;
    const rotation = Math.random() * 4 - 2;
    const color = NOTE_COLORS[0];
    const text = '';
    const width = 250;
    const height = 250;

    const elements = createNoteElement(id, text, x, y, rotation, color, width, height);
    notes.set(id, elements);
    socket.emit('add-note', { id, text, x, y, rotation, color, width, height });
    elements.textarea.focus();
}

// FAB Button functionality
addNoteBtn.addEventListener('click', () => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    addNoteAt(centerX, centerY);
});

// Desktop double-click to add note
board.addEventListener('dblclick', (e) => {
    if (e.target === board) addNoteAt(e.clientX, e.clientY);
});

// Mobile long-press to add note
let touchTimer;
board.addEventListener('touchstart', (e) => {
    if (e.target !== board) return;
    const touch = e.touches[0];
    touchTimer = setTimeout(() => {
        addNoteAt(touch.clientX, touch.clientY);
    }, 800);
}, { passive: true });

board.addEventListener('touchend', () => clearTimeout(touchTimer));
board.addEventListener('touchmove', () => clearTimeout(touchTimer));
