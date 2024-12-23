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


// Local Storage Keys
const ACTIVE_NOTES_KEY = 'stickyNotes_active';
const DELETED_NOTES_KEY = 'stickyNotes_deleted';


// Helper function to parse position values
function parsePosition(value) {
    if (!value) return 0;
    return parseInt(value.replace('px', '')) || 0;
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

// Save deleted notes to localStorage
function saveDeletedNotes() {
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deletedNotes));
}






// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    if (!textarea.value.trim()) return;

    createNote(
        textarea.value.replace(/\n/g, '<br>'),
        colors[0],
        Math.random() * (window.innerWidth - 250) + 50,
        Math.random() * (window.innerHeight - 250) + 50
    );

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
            <button class="done-button bold-toggle ${isBold ? 'active' : ''}" onclick="toggleBold(this)">B</button>
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

    // Content editing
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

    // Mouse events
    note.addEventListener('mousedown', startHandler);
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);

    // Touch events
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
            note.style.left = `${initialX + dx}px`;
            note.style.top = `${initialY + dy}px`;
        }

        if (isResizing) {
            const minWidth = 150;
            const minHeight = 150;
            const newWidth = Math.max(initialW + e.clientX - startX, minWidth);
            const newHeight = Math.max(initialH + e.clientY - startY, minHeight);
            note.style.width = `${newWidth}px`;
            note.style.height = `${newHeight}px`;
        }
    }

    function endHandler() {
        clearTimeout(holdTimer);
        if (isDragging || isResizing) {
            saveActiveNotes();
            if (isDragging) {
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
            <div style="
                grid-column: 1 / -1; 
                text-align: center; 
                padding: 40px;
                color: rgba(255,255,255,0.5);
                font-size: 1.1em;
            ">
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
    if (confirm('Are you sure you want to permanently delete all notes in the trash?')) {
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