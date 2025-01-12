// Global Variables
const colors = [
    '#f0e68c', // Khaki
    '#98ff98', // Light green
    '#ff7eb9', // Pink
    '#7afcff', // Cyan
    '#FE8801', // Orange
    '#ec0c39', // red
    '#AF65EF', // Purple
    '#ffd700', // Yellow
    '#C1C1C1', // Grey
    '#FFFFFF'  // White
];


let deletedNotes = [];
let holdTimer;
let activeNote = null;
let activePalette = null;

let lastSelectedColor = colors[0];
let lastNotePosition = {
    x: window.innerWidth / 2 - 100,  // Default center position
    y: window.innerHeight / 2 - 75
};

// Local Storage Keys
const ACTIVE_NOTES_KEY = 'stickyNotes_active';
const DELETED_NOTES_KEY = 'stickyNotes_deleted';


// Helper function to parse position values
function parsePosition(value) {
    if (!value) return 0;
    return parseInt(value.replace('px', '')) || 0;
}

function getNextNotePosition(lastX, lastY) {
    // Add slight random horizontal offset (-5 to +5 pixels)
    const horizontalOffset = Math.random() * 10 - 5;
    let newX = lastX + horizontalOffset;
    let newY = lastY + 55;  // Move 20px down
    
    // Screen boundaries (with 5px padding)
    const padding = 5;
    const maxX = window.innerWidth - 150;  // Note width is ~150px
    const maxY = window.innerHeight - 100;  // Note height is ~100px
    
    // Reset to top if note would go off bottom of screen
    if (newY > maxY) {
        newY = padding;
        newX = padding + Math.random() * (maxX - padding);  // Random x position at top
    }
    
    // Ensure within bounds
    newX = Math.min(Math.max(newX, -padding), maxX);
    newY = Math.min(Math.max(newY, -padding), maxY);
    
    return { x: newX, y: newY };
}




// Load saved notes on startup
function loadSavedNotes() {
    const savedNotes = localStorage.getItem(ACTIVE_NOTES_KEY);
    if (savedNotes) {
        JSON.parse(savedNotes).forEach(note => {
            const parsedX = parsePosition(note.x);
            const parsedY = parsePosition(note.y);
            createNote(
                note.text, 
                note.color, 
                parsedX, 
                parsedY, 
                true, 
                note.width, 
                note.height,
                note.isBold
            );
        });
    }

    // Load deleted notes
    const savedDeletedNotes = localStorage.getItem(DELETED_NOTES_KEY);
    if (savedDeletedNotes) {
        deletedNotes = JSON.parse(savedDeletedNotes);
        updateTrashCount();
    }
}

// Save active notes to localStorage
function saveActiveNotes() {
    const notes = Array.from(document.querySelectorAll('.sticky-note')).map(note => ({
        text: note.querySelector('.sticky-content').innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width || '200px',
        height: note.style.height || '150px',
        isBold: note.querySelector('.sticky-content').classList.contains('bold')
    }));
    localStorage.setItem(ACTIVE_NOTES_KEY, JSON.stringify(notes));
}

// Save deleted notes to localStorage.
function saveDeletedNotes() {
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deletedNotes));
}






// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    const text = textarea.value.trim();
    
    if (!text) return;  // Don't create empty notes
    
    // Get next position based on last note position
    const nextPosition = getNextNotePosition(lastNotePosition.x, lastNotePosition.y);
    
    // Create the note
    createNote(
        text.replace(/\n/g, '<br>'),
        lastSelectedColor,
        nextPosition.x,
        nextPosition.y
    );
    
    // Update the last position
    lastNotePosition = nextPosition;
    
    // Clear the input
    textarea.value = '';
}


function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.backgroundColor = color;
    note.style.left = typeof x === 'number' ? `${x}px` : x;
    note.style.top = typeof y === 'number' ? `${y}px` : y;
    note.style.width = width;
    note.style.height = height;
    
    note.innerHTML = `
        <div class="sticky-content ${isBold ? 'bold' : ''}" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">
                    ${colors.map(c => `
                        <div class="color-option" style="background-color: ${c}"
                             onclick="changeNoteColor(this, '${c}')"></div>
                    `).join('')}
                </div>
            </div>
            <button  class="bold-toggle ${isBold ? 'active' : ''}" onclick="toggleBold(this)">B</button>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>
    `;

    setupNote(note);
    document.querySelector('.board').appendChild(note);

    if (!isRestored) {
        note.style.animation = 'paperPop 0.3s ease-out forwards';
        saveActiveNotes();
    }

    return note;
}


function setupNote(note) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, initialX, initialY, initialW, initialH;

    const colorButton = note.querySelector('.color-button');
    const colorPalette = note.querySelector('.color-palette');
    const content = note.querySelector('.sticky-content');

    // Content change handler
    const saveContent = () => {
        saveActiveNotes();
    };

    content.addEventListener('blur', saveContent);
    content.addEventListener('input', saveContent);

    // Track position after movement ends
    function updateLastPosition() {
        const rect = note.getBoundingClientRect();
        lastNotePosition.x = rect.left;
        lastNotePosition.y = rect.top;
    }

    // Color picker toggle
    colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // If this palette is already active, don't do anything
        if (activePalette === colorPalette) {
            return;
        }
        
        // Hide other palettes if any are open
        if (activePalette) {
            hideAllColorPalettes();
        }
        
        showColorPalette(colorPalette);
    });

    // Content editing events
    content.addEventListener('dblclick', () => {
        content.contentEditable = "true";
        content.focus();
    });

    content.addEventListener('blur', () => {
        content.contentEditable = "false";
        saveActiveNotes();
    });

    content.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            content.contentEditable = "false";
            saveActiveNotes();
        }
    });

    // Mouse events setup
    note.addEventListener('mousedown', startHandler);
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);

    // Touch events setup
    note.addEventListener('touchstart', e => startHandler(e.touches[0]));
    document.addEventListener('touchmove', e => moveHandler(e.touches[0]));
    document.addEventListener('touchend', endHandler);

    function startHandler(e) {
        if (e.target.closest('.color-palette') || 
            e.target.closest('.done-button')) return;

        startX = e.clientX;
        startY = e.clientY;
        
        if (e.target.closest('.resize-handle')) {
            isResizing = true;
            initialW = note.offsetWidth;
            initialH = note.offsetHeight;
        } else {
            const rect = note.getBoundingClientRect();
            initialX = parsePosition(note.style.left);
            initialY = parsePosition(note.style.top);
            
            holdTimer = setTimeout(() => {
                isDragging = true;
                note.style.zIndex = '1000';
            }, 150);
        }
        
        activeNote = note;
    }

    function moveHandler(e) {
        if (!activeNote || activeNote !== note) return;
    
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            clearTimeout(holdTimer);
        }
    
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            // Calculate new position
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            // Reduced padding and allow partial overflow
            const padding = 5;  // Reduced from 20
            const minX = -padding;
            const minY = -padding;
            const maxX = window.innerWidth - (note.offsetWidth / 4);  // Allow 3/4 of note to go off-screen
            const maxY = window.innerHeight - (note.offsetHeight / 4); // Allow 3/4 of note to go off-screen
            
            newX = Math.min(Math.max(newX, minX), maxX);
            newY = Math.min(Math.max(newY, minY), maxY);
            
            note.style.left = `${newX}px`;
            note.style.top = `${newY}px`;
        }
    
        if (isResizing) {
            const minWidth = 150;
            const minHeight = 150;
            const maxWidth = window.innerWidth - parsePosition(note.style.left) + 50;  // Allow overflow
            const maxHeight = window.innerHeight - parsePosition(note.style.top) + 50; // Allow overflow
            
            const newWidth = Math.min(Math.max(initialW + e.clientX - startX, minWidth), maxWidth);
            const newHeight = Math.min(Math.max(initialH + e.clientY - startY, minHeight), maxHeight);
            
            note.style.width = `${newWidth}px`;
            note.style.height = `${newHeight}px`;
        }
    }

    function endHandler() {
        clearTimeout(holdTimer);
        if (isDragging || isResizing) {
            saveActiveNotes();
            if (isDragging) {
                updateLastPosition();
                checkTrashCollision(note);
            }
        }
        isDragging = false;
        isResizing = false;
        note.style.zIndex = '';
        activeNote = null;
    }
}


// Color Management
function hideAllColorPalettes() {
    document.querySelectorAll('.color-palette').forEach(palette => {
        if (palette.style.display !== 'none') {
            palette.classList.add('closing');
            setTimeout(() => {
                palette.style.display = 'none';
                palette.classList.remove('closing');
            }, 200);
        }
    });
    activePalette = null;
}

function showColorPalette(palette) {
    // First remove any existing classes to ensure clean state
    palette.classList.remove('closing', 'opening');
    
    // Force a reflow
    void palette.offsetWidth;
    
    palette.style.display = 'grid';
    palette.classList.add('opening');
    activePalette = palette;
}


document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
});


function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    note.style.backgroundColor = color;
    note.querySelector('.color-button').style.backgroundColor = color;
    lastSelectedColor = color;
    saveActiveNotes();
}

function toggleBold(button) {
    const note = button.closest('.sticky-note');
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.toggle('bold');
    button.classList.toggle('active');
    saveActiveNotes();
}

// Bin Management
function markAsDone(note) {
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.contains('bold');
    
    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: isBold // Save the bold state
    };

    deletedNotes.unshift(noteData);
    saveDeletedNotes();
    updateTrashCount();

    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.5s ease-in forwards';
    
    setTimeout(() => {
        trashBin.style.animation = 'binShake 0.5s ease-in-out';
    }, 400);

    setTimeout(() => {
        note.remove();
        trashBin.style.animation = '';
        saveActiveNotes();
    }, 500);
}

function checkTrashCollision(note) {
    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    if (noteRect.right > trashRect.left && 
        noteRect.left < trashRect.right && 
        noteRect.bottom > trashRect.top && 
        noteRect.top < trashRect.bottom) {
        markAsDone(note);
        return true;
    }
    return false;
}

// Trash Modal Management
function toggleTrashModal() {
    const modal = document.getElementById('trashModal');
    const isVisible = modal.classList.contains('visible');
    
    if (!isVisible) {
        modal.style.display = 'block';
        modal.offsetHeight; // Force reflow
        modal.classList.add('visible');
        renderDeletedNotes();
    } else {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function renderDeletedNotes() {
    const container = document.querySelector('.deleted-notes-container');
    
    if (deletedNotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                (Empty)
            </div>`;
        return;
    }
    
    container.innerHTML = deletedNotes.map((note, index) => `
        <div class="deleted-note" style="background-color: ${note.color}">
            <div class="deleted-note-content ${note.isBold ? 'bold' : ''}">${note.text}</div>
            <div class="deleted-note-actions">
                <button class="restore-btn" onclick="restoreNote(${index})">Restore</button>
                <button class="delete-btn" onclick="deleteNotePermanently(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}
function restoreNote(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.2s ease-out forwards';
    
    setTimeout(() => {
        const note = deletedNotes[index];
        
        // Create the note with its bold state
        const restoredNote = createNote(
            note.text,
            note.color,
            parsePosition(note.x),
            parsePosition(note.y),
            true,
            note.width,
            note.height,
            note.isBold  // Pass the bold state
        );

        restoredNote.style.animation = 'paperPop 0.3s ease-out forwards';
        
        deletedNotes.splice(index, 1);
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes();
        saveActiveNotes();
    }, 300);
}


function deleteNotePermanently(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.3s ease-out forwards';
    
    setTimeout(() => {
        deletedNotes.splice(index, 1);
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes();
    }, 300);
}

function restoreAllNotes() {
    const notes = document.querySelectorAll('.deleted-note');
    notes.forEach((note, index) => {
        note.classList.add('removing');
        note.style.animation = 'noteDelete 0.2s ease-out forwards';
    });

    setTimeout(() => {
        while (deletedNotes.length > 0) {
            const note = deletedNotes[0];
            createNote(
                note.text,
                note.color,
                parsePosition(note.x),
                parsePosition(note.y),
                true,
                note.width,
                note.height,
                note.isBold  // Pass the bold state
            ).style.animation = 'paperPop 0.3s ease-out forwards';
            
            deletedNotes.splice(0, 1);
            saveActiveNotes();
        }
        saveDeletedNotes();
        updateTrashCount();
        toggleTrashModal();
    }, 300);
}

function clearTrash() {
    if (confirm('Are you sure you want to permanently delete all notes in the Bin?')) {
        const notes = document.querySelectorAll('.deleted-note');
        notes.forEach(note => {
            note.classList.add('removing');
        });
        
        // Wait for animation to complete before clearing
        setTimeout(() => {
            deletedNotes = [];
            saveDeletedNotes();
            updateTrashCount();
            renderDeletedNotes();
            toggleTrashModal(); // Close the modal
        }, 300);
    }
}

function updateTrashCount() {
    const countElement = document.querySelector('.trash-count');
    countElement.textContent = deletedNotes.length;
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('trashModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Check if modal is visible and click is on the backdrop
    if (modal.classList.contains('visible') && 
        e.target === modal) {  // Click is on the modal backdrop
        toggleTrashModal();
    }
});
// Event Listeners
document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
});

document.querySelector('.note-input textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        addNote();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedNotes();
});