// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    const text = textarea.value.trim();

    if (!text) return;  // Don't create empty notes

    // Get the last added note's position and color for this board
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    const notes = Array.from(boardElement.querySelectorAll('.sticky-note'));
    const lastAddedNote = notes[notes.length - 1];

    let lastX = lastNotePositions[currentBoardId].x;
    let lastY = lastNotePositions[currentBoardId].y;
    let lastColor = lastNoteColors[currentBoardId];
    let positionX, positionY;

    // Check if board has weekdays pattern and no notes
    const hasWeekdaysPattern = boardElement.classList.contains('board-pattern-weekdays');
    const hasDaysPattern = boardElement.classList.contains('board-pattern-days');
    const hasNoNotes = notes.length === 0;

    if (hasWeekdaysPattern && hasNoNotes) {
        // Get today's day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const today = new Date().getDay();
        // Convert to 0 = Monday, 1 = Tuesday, ..., 5 = Saturday, 6 = Sunday
        const adjustedDay = today === 0 ? 6 : today - 1;
        
        // Skip Sunday as it's not shown in the weekday headers
        if (adjustedDay < 6) {
            // Get the weekday header
            const weekdayHeader = boardElement.querySelector('.weekday-header');
            if (weekdayHeader) {
                // Position the note under the corresponding day header
                // Each header span is approximately 1/6 of the board width
                const boardWidth = boardElement.offsetWidth;
                const headerWidth = boardWidth / 6;
                
                // Calculate position: center of the day's column
                positionX = (adjustedDay * headerWidth) + (headerWidth / 2) - 100; // 100 is half of note width
                positionY = 60; // Position below the header
            }
        }
    } else if (hasDaysPattern && hasNoNotes) {
        // For day pattern, place the first note under Day 1 header
        const dayHeader = boardElement.querySelector('.day-header');
        if (dayHeader) {
            // Position the note under the Day 1 header
            // Each header span is approximately 1/5 of the board width
            const boardWidth = boardElement.offsetWidth;
            const headerWidth = boardWidth / 5;
            
            // Calculate position: center of the first day's column
            positionX = (headerWidth / 2) - 100; // 100 is half of note width
            positionY = 60; // Position below the header
        }
    } else if (hasNoNotes) {
        // For empty board, position the first note
        const isMobile = window.innerWidth <= 1024;
        if (isMobile) {
            // On mobile: fixed position at (0, 100)
            positionX = 200;
            positionY = 120;
        } else {
            // On desktop: random position in upper half of screen
            const boardRect = boardElement.getBoundingClientRect();
            const boardWidth = boardRect.width;
            const boardHeight = boardRect.height;
            
            // Generate random position
            positionX = Math.floor(Math.random() * (boardWidth - 200)); // 200 is note width
            positionY = Math.floor(Math.random() * (boardHeight / 2)); // Upper half of screen
        }
    } else if (lastAddedNote) {
        // Use the last added note's position and color
        lastX = parsePosition(lastAddedNote.style.left);
        lastY = parsePosition(lastAddedNote.style.top);
        lastColor = lastAddedNote.style.backgroundColor;
        
        // Get next position based on the last added note's position
        const nextPosition = getNextNotePosition(lastX, lastY);
        positionX = nextPosition.x;
        positionY = nextPosition.y;
    } else {
        // Get next position based on the last saved position
        const nextPosition = getNextNotePosition(lastX, lastY);
        positionX = nextPosition.x;
        positionY = nextPosition.y;
    }

    // Create the note on the current board
    createNote(
        text.replace(/\n/g, '<br>'),
        lastColor,
        positionX,
        positionY,
        false,
        '200px',
        '150px',
        false,
        currentBoardId
    );

    // Update the last position and color for this board
    lastNotePositions[currentBoardId] = { x: positionX, y: positionY };
    lastNoteColors[currentBoardId] = lastColor;

    // Clear the input
    textarea.value = '';

    saveActiveNotes();
    updateBoardIndicators(); // Note: updateBoardIndicators is in board.js
}

function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId) {
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
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button> <!-- markAsDone is in trash.js -->
        </div>
        <div class="resize-handle"></div>
    `;

    setupNote(note);

    // Add the note to the correct board
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (boardElement) {
        boardElement.appendChild(note);
    } else {
        console.error(`Board element with ID ${boardId} not found.`);
        return null; // Return null if board doesn't exist
    }


    // Apply paperPop animation to all notes, even when restored
    note.style.animation = 'paperPop 0.3s ease-out forwards';

    if (!isRestored) {
        saveActiveNotes();
    }

    return note;
}

function setupNote(note) {
    let isDragging = false;
    let isResizing = false;
    let isEditing = false;
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
    
    // Double-click to edit
    content.addEventListener('dblclick', function(e) {
        isEditing = true;
        // Set up a one-time click handler on document to detect clicks outside
        setTimeout(() => {
            document.addEventListener('click', cancelEditing);
        }, 0);
    });
    
    // Function to cancel editing when clicking outside
    function cancelEditing(e) {
        if (isEditing && !content.contains(e.target)) {
            isEditing = false;
            content.blur();
            document.removeEventListener('click', cancelEditing);
        }
    }

    // Track position after movement ends
    function updateLastPosition() {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId].x = rect.left;
        lastNotePositions[currentBoardId].y = rect.top;
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

        // If this note is part of a selected group, handle differently
        if (selectedNotes.includes(note) && selectedNotes.length > 1) {
            handleSelectionMove(e); // Note: handleSelectionMove is in selection.js
            return;
        }

        // Clear selection when clicking on a single note if not holding shift
        if (!e.shiftKey) {
            clearSelection(); // Note: clearSelection is in selection.js
        } else if (!selectedNotes.includes(note)) {
            // Add to selection when holding shift
            selectedNotes.push(note);
            note.classList.add('selected');
        }

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
                checkTrashCollision(note); // Note: checkTrashCollision is in trash.js
            }
        }
        isDragging = false;
        isResizing = false;
        note.style.zIndex = '';
        activeNote = null;
    }
    
    // Clean up event listeners when note is removed
    note.addEventListener('remove', function() {
        document.removeEventListener('click', cancelEditing);
    });
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

    // Update all selected notes
    const selectedNotes = document.querySelectorAll('.sticky-note.selected');
    selectedNotes.forEach(selectedNote => {
        if (selectedNote !== note) { // Don't update the current note twice
            selectedNote.style.backgroundColor = color;
            selectedNote.querySelector('.color-button').style.backgroundColor = color;
        }
    });

    lastNoteColors[currentBoardId] = color;
    saveActiveNotes();
}

function toggleBold(button) {
    const note = button.closest('.sticky-note');
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.toggle('bold');
    button.classList.toggle('active');
    saveActiveNotes();
}

// Initialize shortcut icon
let shortcutIcon = document.getElementById('shortcutIcon');
if (!shortcutIcon) {
    shortcutIcon = document.createElement('div');
    shortcutIcon.className = 'shortcut-icon';
    shortcutIcon.id = 'shortcutIcon';
    document.querySelector('.textarea-container').appendChild(shortcutIcon);
}

// Update shortcut icon based on platform and screen size
function updateShortcutIcon() {
    const isMobile = window.innerWidth <= 1024;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    if (isMobile) {
        shortcutIcon.style.display = 'none';
        return;
    }
    
    shortcutIcon.style.display = 'block';
    shortcutIcon.textContent = isMac ? '⌘' : 'Ctrl';
}

// Update shortcut icon on window resize and page load
window.addEventListener('resize', updateShortcutIcon);
updateShortcutIcon();

// Event Listeners for note input
document.querySelector('.note-input textarea').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' && e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        addNote();
    }
});
