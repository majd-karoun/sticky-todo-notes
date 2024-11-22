// Global Variables
const colors = [
    '#ffd700', '#ff7eb9', '#7afcff', '#98ff98', '#ffb347', 
    '#afeeee', '#dda0dd', '#f0e68c', '#deb887', '#90ee90'
];

let deletedNotes = [];
let holdTimer;
let activeNote = null;

// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    if (!textarea.value.trim()) return;

    createNote(
        textarea.value,
        colors[0],
        Math.random() * (window.innerWidth - 250) + 50,
        Math.random() * (window.innerHeight - 250) + 50
    );

    textarea.value = '';
}

function createNote(text, color, x, y, isRestored = false) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.backgroundColor = color;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    
    note.innerHTML = `
        <div class="sticky-content" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">
                    ${colors.map(c => `
                        <div class="color-option" style="background-color: ${c}"
                             onclick="changeNoteColor(this, '${c}')"></div>
                    `).join('')}
                </div>
            </div>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>
    `;

    // Make content editable with double click
    const content = note.querySelector('.sticky-content');
    content.addEventListener('dblclick', () => {
        content.contentEditable = "true";
        content.focus();
    });

    // Save on blur and enter
    content.addEventListener('blur', () => {
        content.contentEditable = "false";
    });

    content.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            content.contentEditable = "false";
        }
    });

    setupNote(note);
    document.querySelector('.board').appendChild(note);

    if (!isRestored) {
        note.style.animation = 'paperPop 0.3s ease-out forwards';
    }

    return note;
}


// Note Interaction Setup
function setupNote(note) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, initialX, initialY, initialW, initialH;

    const colorButton = note.querySelector('.color-button');
    const colorPalette = note.querySelector('.color-palette');

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
            initialX = rect.left;
            initialY = rect.top;
            
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
        if (isDragging) {
            checkTrashCollision(note);
        }
        isDragging = false;
        isResizing = false;
        note.style.zIndex = '';
        activeNote = null;
    }

    colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = colorPalette.style.display === 'grid';
        hideAllColorPalettes();
        colorPalette.style.display = isVisible ? 'none' : 'grid';
    });
}

// Color Management
function hideAllColorPalettes() {
    document.querySelectorAll('.color-palette').forEach(palette => {
        palette.style.display = 'none';
    });
}

function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    note.style.backgroundColor = color;
    note.querySelector('.color-button').style.backgroundColor = color;
    hideAllColorPalettes();
}

// Trash Management
    const noteData = {
        text: note.querySelector('.sticky-content').innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString()
    };

    deletedNotes.unshift(noteData);
    updateTrashCount();

    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.8s ease-in forwards';
    
    setTimeout(() => note.remove(), 800);
    function markAsDone(note) {
        const noteData = {
            text: note.querySelector('.sticky-content').innerHTML,
            color: note.style.backgroundColor,
            x: note.style.left,
            y: note.style.top,
            width: note.style.width,
            height: note.style.height,
            timestamp: new Date().toLocaleString()
        };
    
        deletedNotes.unshift(noteData);
        updateTrashCount();
    
        const trashBin = document.querySelector('.trash-bin');
        const trashRect = trashBin.getBoundingClientRect();
        const noteRect = note.getBoundingClientRect();
    
        const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
        const throwY = trashRect.top - noteRect.top;
    
        note.style.setProperty('--throwX', `${throwX}px`);
        note.style.setProperty('--throwY', `${throwY}px`);
        note.style.animation = 'paperCrumble 0.5s ease-in forwards';
        
        // Add bin shake animation after note reaches bin
        setTimeout(() => {
            trashBin.style.animation = 'binShake 0.5s ease-in-out';
        }, 400);
    
        setTimeout(() => {
            note.remove();
            trashBin.style.animation = '';
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
        // Force reflow
        modal.offsetHeight;
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
    container.innerHTML = deletedNotes.map((note, index) => `
        <div class="deleted-note" style="background-color: ${note.color}">
            <div class="deleted-note-content">${note.text}</div>
            <div class="deleted-note-timestamp">Deleted: ${note.timestamp}</div>
            <div class="deleted-note-actions">
                <button class="restore-btn" onclick="restoreNote(${index})">Restore</button>
                <button class="delete-btn" onclick="deleteNotePermanently(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}

function restoreNote(index) {
    const note = deletedNotes[index];
    createNote(note.text, note.color, 
        parseInt(note.x) || window.innerWidth/2 - 100,
        parseInt(note.y) || window.innerHeight/2 - 100,
        true
    ).style.animation = 'paperPop 0.3s ease-out forwards';
    
    deletedNotes.splice(index, 1);
    updateTrashCount();
    renderDeletedNotes();
}

function deleteNotePermanently(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    
    setTimeout(() => {
        deletedNotes.splice(index, 1);
        updateTrashCount();
        renderDeletedNotes();
    }, 200);
}


function restoreAllNotes() {
    while (deletedNotes.length > 0) {
        restoreNote(0);
    }
    toggleTrashModal();
}

function clearTrash() {
    if (confirm('Are you sure you want to permanently delete all notes in the trash?')) {
        deletedNotes = [];
        updateTrashCount();
        renderDeletedNotes();
    }
}

function updateTrashCount() {
    const countElement = document.querySelector('.trash-count');
    countElement.textContent = deletedNotes.length;
}

// Event Listeners
document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
});

// Initialize
updateTrashCount();