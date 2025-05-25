// Track note columns for weekday patterns
let noteColumns = {};

// Function to get a random offset for natural positioning
function getRandomOffset() {
    return (Math.random() * 40) - 20; // Random value between -20 and 20
}

// Function to get the column index based on date (0-4 for Monday-Friday, 0 for Sunday)
function getDayColumnIndex(date = new Date()) {
    const day = date.getDay(); // 0 = Sunday, ..., 6 = Saturday
    return day === 0 ? 0 : (day - 1) % 5; // 0-4 = Monday-Friday, 0 = Sunday (treated as Monday)
}

// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    const text = textarea.value.trim();
    if (!text) return;

    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    const notes = Array.from(boardElement.querySelectorAll('.sticky-note'));
    const lastAddedNote = notes[notes.length - 1];

    let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || { x: 0, y: 0 };
    let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
    let positionX, positionY;

    const hasWeekdaysPattern = boardElement.classList.contains('board-pattern-weekdays');
    const hasDaysPattern = boardElement.classList.contains('board-pattern-days');
    const hasNoNotes = notes.length === 0;

    if (hasNoNotes) {
        if (hasWeekdaysPattern) {
            const columnIndex = getDayColumnIndex();
            const boardWidth = boardElement.offsetWidth;
            const headerWidth = boardWidth / 6;
            
            // Calculate base position for the column
            const baseX = (columnIndex * headerWidth) + (headerWidth / 2) - 100;
            
            // Add a small random offset for natural look
            const randomOffset = getRandomOffset();
            positionX = Math.max(10, Math.min(boardWidth - 210, baseX + randomOffset));
            positionY = 70; // Below header
            
            // Store the initial position for this column
            if (!noteColumns[columnIndex]) {
                noteColumns[columnIndex] = [];
            }
            noteColumns[columnIndex].push({ x: positionX, y: positionY });
            
        } else if (hasDaysPattern) {
            const boardWidth = boardElement.offsetWidth;
            const headerWidth = boardWidth / 5;
            positionX = (headerWidth / 2) - 100;
            positionY = 70; // Initial position below header
        } else {
            if (window.innerWidth <= 1024) { // Mobile
                positionX = 200;
                positionY = 140; // 70 * 2 for mobile
            } else { // Desktop
                const boardRect = boardElement.getBoundingClientRect();
                positionX = Math.floor(Math.random() * (boardRect.width - 200));
                positionY = Math.floor(Math.random() * (boardRect.height / 2));
            }
        }
    } else if (hasWeekdaysPattern) {
        const boardRect = boardElement.getBoundingClientRect();
        const boardWidth = boardRect.width;
        const columnWidth = boardWidth / 6; // 6 columns for 6 weekdays
        
        // Determine column based on current date
        const columnIndex = getDayColumnIndex();
        
        // Initialize column if it doesn't exist
        if (!noteColumns[columnIndex]) {
            noteColumns[columnIndex] = [];
        }
        
        // Get all notes in this column
        const columnNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).filter(note => {
            const noteRect = note.getBoundingClientRect();
            const noteCenterX = noteRect.left + (noteRect.width / 2) - boardRect.left;
            const noteColumn = Math.min(5, Math.max(0, Math.floor(noteCenterX / columnWidth)));
            return noteColumn === columnIndex;
        });
        
        // Find the last note in this column
        let lastNoteInColumn = null;
        let lastY = 60; // Start below header
        
        // Find the note with the highest Y position in this column
        columnNotes.forEach(note => {
            const noteY = parsePosition(note.style.top);
            if (noteY >= lastY) {
                lastY = noteY;
                lastNoteInColumn = note;
            }
        });
        
        // Calculate base position for the column with random offset
        const baseX = (columnIndex * columnWidth) + (columnWidth / 2) - 100;
        const randomOffset = getRandomOffset();
        positionX = Math.max(10, Math.min(boardWidth - 210, baseX + randomOffset));
        
        // Position the new note with 70px spacing
        positionY = lastNoteInColumn ? lastY + 70 : 60; // 70px below the last note
        
        // Update noteColumns for this column
        if (!noteColumns[columnIndex]) {
            noteColumns[columnIndex] = [];
        }
        noteColumns[columnIndex].push({ x: positionX, y: positionY });
        
        lastColor = lastAddedNote.style.backgroundColor;
    } else if (lastAddedNote) {
        // For boards without headers, use the existing logic
        lastX = parsePosition(lastAddedNote.style.left);
        lastY = parsePosition(lastAddedNote.style.top);
        lastColor = lastAddedNote.style.backgroundColor;
        ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));
    } else {
        ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));
    }

    createNote(text.replace(/\n/g, '<br>'), lastColor, positionX, positionY, false, '200px', '150px', false, currentBoardId);
    lastNotePositions[currentBoardId] = { x: positionX, y: positionY };
    lastNoteColors[currentBoardId] = lastColor;
    textarea.value = '';
    saveActiveNotes();
    updateBoardIndicators();
}

function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.cssText = `background-color:${color}; left:${typeof x === 'number' ? x+'px' : x}; top:${typeof y === 'number' ? y+'px' : y}; width:${width}; height:${height};`;
    note.innerHTML = `
        <div class="sticky-content ${isBold ? 'bold' : ''}" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">${colors.map(c => `<div class="color-option" style="background-color: ${c}" onclick="changeNoteColor(this, '${c}')"></div>`).join('')}</div>
            </div>
            <button class="bold-toggle ${isBold ? 'active' : ''}" onclick="toggleBold(this)">B</button>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>`;
    setupNote(note);
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (boardElement) boardElement.appendChild(note);
    else { console.error(`Board element with ID ${boardId} not found.`); return null; }
    note.style.animation = 'paperPop 0.3s ease-out forwards';
    if (!isRestored) saveActiveNotes();
    return note;
}

function setupNote(note) {
    let isDragging = false, isResizing = false, isEditing = false;
    let startX, startY, initialX, initialY, initialW, initialH, holdTimer;
    const colorButton = note.querySelector('.color-button');
    const colorPalette = note.querySelector('.color-palette');
    const content = note.querySelector('.sticky-content');
    activeNote = null; // Ensure activeNote is scoped or defined globally

    const saveContent = () => saveActiveNotes();
    content.addEventListener('blur', saveContent);
    content.addEventListener('input', saveContent);

    const cancelEditing = (e) => {
        if (isEditing && !content.contains(e.target)) {
            isEditing = false; content.blur();
            document.removeEventListener('click', cancelEditing);
        }
    };
    content.addEventListener('dblclick', () => {
        isEditing = true;
        content.contentEditable = "true"; content.focus();
        setTimeout(() => document.addEventListener('click', cancelEditing), 0);
    });
    content.addEventListener('blur', () => content.contentEditable = "false"); // Already have saveContent on blur
    content.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) { content.contentEditable = "false"; saveActiveNotes(); }
            else {
                const selection = window.getSelection(); const range = selection.getRangeAt(0);
                const newLine = document.createElement('span');
                newLine.style.fontFamily = "'Comic Neue', cursive"; newLine.innerHTML = '<br>';
                range.deleteContents(); range.insertNode(newLine);
                range.setStartAfter(newLine); range.collapse(true);
                selection.removeAllRanges(); selection.addRange(range);
            }
        }
    });

    const updateLastPosition = () => {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId] = { x: rect.left, y: rect.top };
    };

    colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activePalette === colorPalette) return;
        if (activePalette) hideAllColorPalettes();
        showColorPalette(colorPalette);
    });

    const handleInteractionStart = (e, clientX, clientY) => {
        if (e.target.closest('.color-palette, .done-button')) return;
        if (selectedNotes.includes(note) && selectedNotes.length > 1) { handleSelectionMove(e); return; }
        if (!e.shiftKey) clearSelection();
        else if (!selectedNotes.includes(note)) { selectedNotes.push(note); note.classList.add('selected'); }

        startX = clientX; startY = clientY;
        if (e.target.closest('.resize-handle')) {
            isResizing = true; initialW = note.offsetWidth; initialH = note.offsetHeight;
        } else {
            initialX = parsePosition(note.style.left); initialY = parsePosition(note.style.top);
            holdTimer = setTimeout(() => { isDragging = true; note.style.zIndex = '1000'; }, 150);
        }
        activeNote = note;
    };
    const handleInteractionMove = (clientX, clientY) => {
        if (!activeNote || activeNote !== note) return;
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) clearTimeout(holdTimer);

        if (isDragging) {
            let newX = initialX + clientX - startX;
            let newY = initialY + clientY - startY;
            const padding = 5;
            const minX = -padding, minY = -padding;
            const maxX = window.innerWidth - (note.offsetWidth / 4);
            const maxY = window.innerHeight - (note.offsetHeight / 4);
            newX = Math.min(Math.max(newX, minX), maxX);
            newY = Math.min(Math.max(newY, minY), maxY);
            note.style.left = `${newX}px`; note.style.top = `${newY}px`;
        }
        if (isResizing) {
            const minW = 150, minH = 150;
            const maxW = window.innerWidth - parsePosition(note.style.left) + 50;
            const maxH = window.innerHeight - parsePosition(note.style.top) + 50;
            note.style.width = `${Math.min(Math.max(initialW + clientX - startX, minW), maxW)}px`;
            note.style.height = `${Math.min(Math.max(initialH + clientY - startY, minH), maxH)}px`;
        }
    };
    const handleInteractionEnd = () => {
        clearTimeout(holdTimer);
        if (isDragging || isResizing) {
            saveActiveNotes();
            if (isDragging) { updateLastPosition(); checkTrashCollision(note); }
        }
        isDragging = false; isResizing = false;
        note.style.zIndex = ''; activeNote = null;
    };

    note.addEventListener('mousedown', e => handleInteractionStart(e, e.clientX, e.clientY));
    document.addEventListener('mousemove', e => handleInteractionMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', handleInteractionEnd);
    note.addEventListener('touchstart', e => handleInteractionStart(e, e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    document.addEventListener('touchmove', e => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    document.addEventListener('touchend', handleInteractionEnd);
    note.addEventListener('remove', () => document.removeEventListener('click', cancelEditing));
}

function hideAllColorPalettes() {
    document.querySelectorAll('.color-palette').forEach(palette => {
        if (palette.style.display !== 'none') {
            palette.classList.add('closing');
            setTimeout(() => { palette.style.display = 'none'; palette.classList.remove('closing'); }, 200);
        }
    });
    activePalette = null;
}

function showColorPalette(palette) {
    palette.classList.remove('closing', 'opening');
    void palette.offsetWidth; // Reflow
    palette.style.display = 'grid';
    palette.classList.add('opening');
    activePalette = palette;
}

document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) hideAllColorPalettes();
});

function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    const notesToChange = note.classList.contains('selected') ? document.querySelectorAll('.sticky-note.selected') : [note];
    notesToChange.forEach(n => {
        n.style.backgroundColor = color;
        n.querySelector('.color-button').style.backgroundColor = color;
    });
    lastNoteColors[currentBoardId] = color;
    saveActiveNotes();
}

function toggleBold(button) {
    const content = button.closest('.sticky-note').querySelector('.sticky-content');
    content.classList.toggle('bold');
    button.classList.toggle('active');
    saveActiveNotes();
}

let shortcutIcon = document.getElementById('shortcutIcon');
if (!shortcutIcon) {
    shortcutIcon = document.createElement('div');
    shortcutIcon.className = 'shortcut-icon';
    shortcutIcon.id = 'shortcutIcon';
    document.querySelector('.textarea-container').appendChild(shortcutIcon);
}
function updateShortcutIcon() {
    const isMobile = window.innerWidth <= 1024;
    shortcutIcon.style.display = isMobile ? 'none' : 'block';
    if (!isMobile) shortcutIcon.textContent = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl';
}
window.addEventListener('resize', updateShortcutIcon);
updateShortcutIcon();

document.querySelector('.note-input textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        e.preventDefault(); addNote();
    }
});