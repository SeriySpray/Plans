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

let globalMaxZ = 1000;
const BOARD_WIDTH = 3000;
const BOARD_HEIGHT = 3000;

// Throttling helper
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Center view on start
window.scrollTo(BOARD_WIDTH/2 - window.innerWidth / 2, BOARD_HEIGHT/2 - window.innerHeight / 2);

function generateId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
}

// Helper to create a note element
function createNoteElement(id, text, x, y, rotation, color, width, height, shouldFocus, zIndex) {
    const noteEl = document.createElement('div');
    noteEl.className = 'sticky-note';
    noteEl.id = id;
    
    // Initial Clamping for Safety
    const safeWidth = width || 250;
    const safeHeight = height || 250;
    const safeX = Math.min(Math.max(0, x), BOARD_WIDTH - safeWidth);
    const safeY = Math.min(Math.max(0, y), BOARD_HEIGHT - safeHeight);

    noteEl.style.left = `${safeX}px`;
    noteEl.style.top = `${safeY}px`;
    noteEl.style.width = `${safeWidth}px`;
    noteEl.style.height = `${safeHeight}px`;
    noteEl.style.transform = `rotate(${rotation}deg)`;
    noteEl.style.backgroundColor = color || NOTE_COLORS[0];
    
    const currentZ = zIndex || ++globalMaxZ;
    noteEl.style.zIndex = currentZ;
    if (currentZ > globalMaxZ) globalMaxZ = currentZ;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';

    const textarea = document.createElement('textarea');
    textarea.value = text || '';
    textarea.placeholder = 'Type...';

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        socket.emit('delete-note', id);
        removeNote(id);
    };

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

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

    noteEl.appendChild(dragHandle);
    noteEl.appendChild(deleteBtn);
    noteEl.appendChild(resizeHandle);
    noteEl.appendChild(colorPicker);
    noteEl.appendChild(textarea);
    board.appendChild(noteEl);

    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const bringToFront = () => {
        const newZ = ++globalMaxZ;
        noteEl.style.zIndex = newZ;
        socket.emit('update-note', { id, z_index: newZ });
    };

    const syncUpdates = throttle((data) => {
        socket.emit('update-note', data);
    }, 40);

    const onStart = (e) => {
        const isResizeAction = e.target === resizeHandle;
        const isDragAction = e.target === dragHandle;
        if (!isDragAction && !isResizeAction) return;

        bringToFront();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const rect = board.getBoundingClientRect();

        if (isResizeAction) {
            isResizing = true;
            startWidth = noteEl.offsetWidth;
            startHeight = noteEl.offsetHeight;
            startX = clientX;
            startY = clientY;
        } else {
            isDragging = true;
            startX = (clientX - rect.left) - noteEl.offsetLeft;
            startY = (clientY - rect.top) - noteEl.offsetTop;
        }
        
        noteEl.classList.add('active');
        if (e.cancelable) e.preventDefault(); 
    };

    const onMove = (e) => {
        if (!isDragging && !isResizing) return;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        if (isResizing) {
            // Clamp size so it doesn't go off board
            let newWidth = Math.max(150, startWidth + (clientX - startX));
            let newHeight = Math.max(150, startHeight + (clientY - startY));
            
            // Limit width by board edge
            if (noteEl.offsetLeft + newWidth > BOARD_WIDTH) newWidth = BOARD_WIDTH - noteEl.offsetLeft;
            // Limit height by board edge
            if (noteEl.offsetTop + newHeight > BOARD_HEIGHT) newHeight = BOARD_HEIGHT - noteEl.offsetTop;

            noteEl.style.width = `${newWidth}px`;
            noteEl.style.height = `${newHeight}px`;
            syncUpdates({ id, width: newWidth, height: newHeight });
        } else if (isDragging) {
            const rect = board.getBoundingClientRect();
            let newX = (clientX - rect.left) - startX;
            let newY = (clientY - rect.top) - startY;
            
            // CLAMPING POSITION
            newX = Math.min(Math.max(0, newX), BOARD_WIDTH - noteEl.offsetWidth);
            newY = Math.min(Math.max(0, newY), BOARD_HEIGHT - noteEl.offsetHeight);

            noteEl.style.left = `${newX}px`;
            noteEl.style.top = `${newY}px`;
            syncUpdates({ id, x: newX, y: newY });
        }
        if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
        if (isDragging || isResizing) {
            isDragging = false;
            isResizing = false;
            noteEl.classList.remove('active');
            socket.emit('update-note', { 
                id, 
                x: noteEl.offsetLeft, 
                y: noteEl.offsetTop,
                width: noteEl.offsetWidth,
                height: noteEl.offsetHeight
            });
        }
    };

    noteEl.addEventListener('mousedown', onStart);
    noteEl.addEventListener('touchstart', onStart, { passive: false });
    noteEl.addEventListener('click', bringToFront);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);

    textarea.addEventListener('input', throttle(() => {
        socket.emit('update-note', { id, text: textarea.value });
    }, 200));

    if (shouldFocus) textarea.focus();
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
    if (!initialNotes) return;
    initialNotes.forEach(note => {
        if (!notes.has(note.id)) {
            const elements = createNoteElement(note.id, note.text, note.x, note.y, note.rotation, note.color, note.width, note.height, false, note.z_index);
            notes.set(note.id, elements);
        }
    });
});

socket.on('note-added', (note) => {
    if (!notes.has(note.id)) {
        const elements = createNoteElement(note.id, note.text, note.x, note.y, note.rotation, note.color, note.width, note.height, false, note.z_index);
        notes.set(note.id, elements);
    }
});

socket.on('note-updated', (data) => {
    const note = notes.get(data.id);
    if (note) {
        note.noteEl.style.transition = 'left 0.15s linear, top 0.15s linear, width 0.15s linear, height 0.15s linear, background-color 0.2s';
        if (data.x !== undefined && data.y !== undefined) {
            note.noteEl.style.left = `${data.x}px`;
            note.noteEl.style.top = `${data.y}px`;
        }
        if (data.text !== undefined) note.textarea.value = data.text;
        if (data.color !== undefined) note.noteEl.style.backgroundColor = data.color;
        if (data.width !== undefined && data.height !== undefined) {
            note.noteEl.style.width = `${data.width}px`;
            note.noteEl.style.height = `${data.height}px`;
        }
        if (data.z_index !== undefined) {
            note.noteEl.style.zIndex = data.z_index;
            if (data.z_index > globalMaxZ) globalMaxZ = data.z_index;
        }
        setTimeout(() => {
            if (!note.noteEl.classList.contains('active')) {
                note.noteEl.style.transition = 'transform 0.1s ease, background-color 0.2s';
            }
        }, 160);
    }
});

socket.on('note-deleted', (id) => removeNote(id));
socket.on('notes-cleared', () => {
    notes.forEach((_, id) => removeNote(id));
});

function addNoteAt(clientX, clientY, shouldFocus) {
    const id = generateId();
    const rect = board.getBoundingClientRect();
    
    // CLAMPING CREATION
    let x = (clientX - rect.left) - 125;
    let y = (clientY - rect.top) - 125;
    x = Math.min(Math.max(0, x), BOARD_WIDTH - 250);
    y = Math.min(Math.max(0, y), BOARD_HEIGHT - 250);

    const note = {
        id, text: '', x, y,
        rotation: Math.random() * 4 - 2,
        color: NOTE_COLORS[0],
        width: 250, height: 250,
        z_index: ++globalMaxZ
    };

    const elements = createNoteElement(note.id, note.text, note.x, note.y, note.rotation, note.color, note.width, note.height, shouldFocus, note.z_index);
    notes.set(note.id, elements);
    socket.emit('add-note', note);
}

// SIMULATE DBLCLICK for accuracy
let lastClickX = 0, lastClickY = 0, lastClickTime = 0;
board.addEventListener('mousedown', (e) => {
    if (e.target !== board) return;
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastClickTime;
    const dist = Math.sqrt(Math.pow(e.clientX - lastClickX, 2) + Math.pow(e.clientY - lastClickY, 2));
    if (timeDiff < 400 && dist < 30) {
        addNoteAt(e.clientX, e.clientY, true);
        lastClickTime = 0;
    } else {
        lastClickX = e.clientX; lastClickY = e.clientY; lastClickTime = currentTime;
    }
});

// MOBILE DOUBLE TAP with proximity check (NO KEYBOARD AUTO-OPEN)
let lastTapX = 0, lastTapY = 0, lastTapTime = 0;
board.addEventListener('touchend', (e) => {
    if (e.target !== board) return;
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastTapTime;
    const touch = e.changedTouches[0];
    const dist = Math.sqrt(Math.pow(touch.clientX - lastTapX, 2) + Math.pow(touch.clientY - lastTapY, 2));

    if (timeDiff < 500 && dist < 25) {
        addNoteAt(touch.clientX, touch.clientY, false);
        e.preventDefault();
        lastTapTime = 0;
    } else {
        lastTapX = touch.clientX; lastTapY = touch.clientY; lastTapTime = currentTime;
    }
});

// Clear Board Functionality
document.getElementById('clear-board-btn').onclick = () => {
    if (confirm("Are you sure you want to clear the entire board? This cannot be undone.")) {
        socket.emit('delete-all');
    }
};

window.clearBoard = () => socket.emit('delete-all');
