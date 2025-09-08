/**
 * NOTE CREATION MODULE
 * Handles the creation, positioning, and initial setup of sticky notes
 * Supports different board patterns (weekdays, days, regular) with intelligent positioning
 */

// Global state for note management
let noteColumns = {}, repositionedNotes = new Set();

// Utility functions for note creation
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomOffset = () => (Math.random() * 40) - 20; // Random positioning offset for natural look
const getDayColumnIndex = (date = getCurrentDate()) => date.getDay() === 0 ? 0 : date.getDay() - 1; // Convert Sunday=0 to Saturday=5 format

/**
 * Shows a temporary message when note limits are reached
 * @param {string} message - The message to display to the user
 */
function showNoteLimitMessage(message) {
    const limitMessage = document.getElementById('noteLimitMessage');
    const textElement = limitMessage?.querySelector('.transfer-text');
    if (textElement) textElement.textContent = message;
    if (limitMessage) {
        limitMessage.classList.add('visible');
        setTimeout(() => limitMessage.classList.remove('visible'), 3000);
    }
}


/**
 * Main function to add a new note to the current board
 * Handles intelligent positioning based on board patterns and existing notes
 * Supports weekdays pattern, days pattern, and regular free-form layout
 */
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    const text = textarea.value.trim();
    if (!text) return;

    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    const notes = Array.from(boardElement.querySelectorAll('.sticky-note'));
    const [hasWeekdaysPattern, hasDaysPattern, hasNoNotes] = [
        boardElement.classList.contains('board-pattern-weekdays'),
        boardElement.classList.contains('board-pattern-days'),
        notes.length === 0
    ];

    // Check note limits for regular boards (pattern boards have different limits)
    if (!hasWeekdaysPattern && !hasDaysPattern && notes.length >= 30) {
        showNoteLimitMessage(`Maximum notes space reached.`);
        return;
    }

    // Get positioning context from last note and board state
    const lastAddedNote = notes[notes.length - 1];
    let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || { x: 0, y: 0 };
    let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
    let positionX, positionY;

    /**
     * Calculates column data for pattern-based boards (weekdays/days)
     * @param {number} columnIndex - Which column to analyze (0-based)
     * @param {number} columnCount - Total number of columns
     * @param {Element} excludeNote - Note to exclude from calculations
     * @returns {Object} Column positioning data and existing notes
     */
    const getColumnData = (columnIndex, columnCount, excludeNote = null) => {
        const columnWidth = boardElement.offsetWidth / columnCount;
        const baseX = (columnIndex * columnWidth) + 10;
        const maxX = (columnIndex + 1) * columnWidth - 210;
        const positionX = Math.max(baseX, Math.min(maxX, baseX + getRandomOffset()));
        
        // Find all notes that significantly overlap with this column
        const allNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).filter(note => note.style.display !== 'none' && note !== excludeNote);
        const [columnStartX, columnEndX] = [columnIndex * columnWidth, (columnIndex + 1) * columnWidth];
        const columnNotes = allNotes.filter(note => {
            const [noteLeft, noteRight] = [parsePosition(note.style.left), parsePosition(note.style.left) + 200];
            const [overlapStart, overlapEnd] = [Math.max(noteLeft, columnStartX), Math.min(noteRight, columnEndX)];
            return Math.max(0, overlapEnd - overlapStart) / 200 > 0.5; // 50% overlap threshold
        });
        
        return { positionX, columnNotes };
    };

    /**
     * Finds available position in columns for pattern-based boards
     * @param {number} startColumn - Preferred starting column
     * @param {number} columnCount - Total columns available
     * @returns {boolean} True if position found, false if no space
     */
    const findColumnPosition = (startColumn, columnCount) => {
        const bottomThreshold = window.innerHeight - 300;
        
        // Try each column starting from preferred column
        for (let attempts = 0; attempts < columnCount; attempts++) {
            const columnIndex = (startColumn + attempts) % columnCount;
            const { positionX: colX, columnNotes } = getColumnData(columnIndex, columnCount);
            
            // Find the lowest note in this column
            let lastY = 60, lastNote = null;
            columnNotes.forEach(note => {
                const noteY = parsePosition(note.style.top);
                if (noteY >= lastY) { lastY = noteY; lastNote = note; }
            });
            
            // Calculate new position below the last note
            const newY = lastNote ? lastY + 70 : 60;
            if (newY <= bottomThreshold) {
                positionX = colX;
                positionY = newY;
                if (lastNote) lastColor = lastNote.style.backgroundColor; // Inherit color from column
                return true;
            }
        }
        showNoteLimitMessage(`Maximum notes space reached.`);
        return false;
    };

    /**
     * Handles positioning for pattern-based boards (weekdays/days)
     * @param {boolean} isWeekday - True for weekdays pattern, false for days pattern
     * @returns {boolean} True if position found successfully
     */
    const handlePatternPositioning = (isWeekday) => {
        let columnIndex;
        const columnCount = isWeekday ? 6 : 5; // 6 weekdays (Mon-Sat) or 5 days
        
        // Always continue from the last added note's position (like regular patterns)
        if (lastAddedNote) {
            // Calculate which column the last note is in
            const noteX = parsePosition(lastAddedNote.style.left);
            const columnWidth = boardElement.offsetWidth / columnCount;
            columnIndex = Math.floor(noteX / columnWidth);
            // Ensure column index is within valid range
            columnIndex = Math.max(0, Math.min(columnIndex, columnCount - 1));
        } else {
            // Default behavior: use current day's column (only when no notes exist)
            columnIndex = isWeekday ? getDayColumnIndex() : (getCurrentDayNumber(currentBoardId) || 0);
        }
        
        return findColumnPosition(columnIndex, columnCount);
    };

    // MAIN POSITIONING LOGIC - Handle different board types and scenarios
    
    if (hasNoNotes) {
        // First note on the board
        if (hasWeekdaysPattern || hasDaysPattern) {
            if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
        } else {
            // Regular board - place first note in a good starting position
            [positionX, positionY] = [Math.max(150, window.innerWidth / 4), 50];
        }
    } else if (hasWeekdaysPattern || hasDaysPattern) {
        // Pattern boards - use column-based positioning
        if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
    } else {
        // Regular boards - use intelligent free-form positioning
        if (lastAddedNote) {
            [lastX, lastY, lastColor] = [parsePosition(lastAddedNote.style.left), parsePosition(lastAddedNote.style.top), lastAddedNote.style.backgroundColor];
        }
        ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));
        
        // Handle vertical breaks when reaching top of screen (line wrapping)
        if (positionY <= 50) {
            const notesInColumn = notes.filter(note => Math.abs(parsePosition(note.style.left) - positionX) < 150);
            
            if (notesInColumn.length > 0) {
                const noteYs = notesInColumn.map(note => parsePosition(note.style.top));
                const [lowestY, highestY] = [Math.max(...noteYs), Math.min(...noteYs)];
                const bottomThreshold = window.innerHeight - 300;
                const [proposedY, proposedUpwardY] = [lowestY + 200, highestY - 200];
                
                // Try placing below existing notes
                if (proposedY <= bottomThreshold) {
                    positionY = proposedY;
                } else if (proposedUpwardY >= 50) {
                    // Try placing above existing notes
                    positionY = proposedUpwardY;
                } else {
                    // Column is full - find space in adjacent columns
                    const findSpaceInColumns = (startX, direction) => {
                        const maxX = window.innerWidth - 200;
                        for (let testX = startX; direction > 0 ? testX <= maxX : testX >= 55; testX += direction * 250) {
                            const testNotes = notes.filter(note => Math.abs(parsePosition(note.style.left) - testX) < 150);
                            if (testNotes.length === 0) return { x: testX, y: 50 };
                            
                            const testYs = testNotes.map(note => parsePosition(note.style.top));
                            const [testLowest, testHighest] = [Math.max(...testYs), Math.min(...testYs)];
                            const [testDown, testUp] = [testLowest + 200, testHighest - 200];
                            
                            if (testDown <= bottomThreshold) return { x: testX, y: testDown };
                            if (testUp >= 50) return { x: testX, y: testUp };
                        }
                        return null;
                    };
                    
                    // Search right first, then left
                    const space = findSpaceInColumns(positionX + 250, 1) || findSpaceInColumns(positionX - 250, -1);
                    if (space) {
                        [positionX, positionY] = [space.x, space.y];
                    } else {
                        showNoteLimitMessage(`Maximum notes space reached.`);
                        return;
                    }
                }
            }
        }
    }

    // Create the note with calculated position and styling
    createNote(text.replace(/\n/g, '<br>'), lastColor, positionX, positionY, false, '200px', '150px', false, currentBoardId);
    [lastNotePositions[currentBoardId], lastNoteColors[currentBoardId], textarea.value] = [{ x: positionX, y: positionY }, lastColor, ''];
    saveActiveNotes();
    updateBoardIndicators();
}

/**
 * Creates a new sticky note DOM element with all necessary components
 * @param {string} text - The note content (HTML allowed)
 * @param {string} color - Background color for the note
 * @param {number} x - X position in pixels
 * @param {number} y - Y position in pixels
 * @param {boolean} isRestored - Whether this is being restored from storage
 * @param {string} width - CSS width value
 * @param {string} height - CSS height value
 * @param {boolean} isBold - Whether text should be bold
 * @param {number} boardId - Target board ID
 * @param {boolean} repositioned - Whether note has been moved
 * @returns {Element} The created note element
 */
function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId, repositioned = false) {
    const [note, noteId] = [document.createElement('div'), generateNoteId()];
    
    // Build note structure with content, controls, and resize handle
    Object.assign(note, {
        className: 'sticky-note',
        innerHTML: `<div class="sticky-content ${isBold ? 'bold' : ''}" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">${colors.map(c => `<div class="color-option" style="background-color: ${c}" onclick="changeNoteColor(this, '${c}')"></div>`).join('')}</div>
            </div>
            <button class="bold-toggle ${isBold ? 'active' : ''}" onclick="toggleBold(this)">B</button>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>`
    });
    
    // Determine z-index based on board pattern and note type
    let noteZIndex;
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    const hasPattern = boardElement && (boardElement.classList.contains('board-pattern-weekdays') || boardElement.classList.contains('board-pattern-days'));
    
    if (repositioned) {
        // Repositioned notes get higher z-index to appear on top
        noteZIndex = ++globalZIndex;
    } else if (hasPattern && !isRestored) {
        // New notes in pattern boards get lower z-index to appear underneath repositioned notes
        // Find the minimum z-index of repositioned notes, or use base if none exist
        const repositionedZIndexes = Object.values(noteZIndexes).filter(z => z > 1000);
        noteZIndex = repositionedZIndexes.length > 0 ? Math.min(...repositionedZIndexes) - 1 : 1000;
    } else {
        // Regular boards or restored notes use incremental z-index
        noteZIndex = ++globalZIndex;
    }
    
    // Apply styling and positioning
    note.style.cssText = `background-color:${color}; left:${x}px; top:${y}px; width:${width}; height:${height}; z-index:${noteZIndex};`;
    note.dataset.noteId = noteId;
    if (repositioned) { note.dataset.repositioned = 'true'; repositionedNotes.add(noteId); }
    
    // Store z-index for layering management
    noteZIndexes[noteId] = noteZIndex;
    saveNoteZIndexes();

    // Add click handler to bring note to front (avoid triggering on controls)
    note.addEventListener('click', (e) => {
        if (!e.target.closest('.note-controls, .sticky-content[contenteditable="true"]')) {
            bringNoteToFront(note);
        }
    });

    // Setup interaction handlers (drag, resize, edit)
    setupNote(note);
    
    // Add to target board
    const targetBoard = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!targetBoard) { console.error(`Board element with ID ${boardId} not found.`); return null; }
    
    targetBoard.appendChild(note);
    note.style.animation = 'paperPop 0.3s ease-out forwards'; // Entry animation
    if (!isRestored) saveActiveNotes();
    return note;
}

/**
 * COLOR AND STYLING FUNCTIONS
 */

/**
 * Changes the color of a note or selected notes
 * @param {Element} option - The color option element clicked
 * @param {string} color - The new color to apply
 */
function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    const notesToChange = note.classList.contains('selected') ? document.querySelectorAll('.sticky-note.selected') : [note];
    notesToChange.forEach(n => {
        const colorButton = n.querySelector('.color-button');
        [n, colorButton].forEach(el => el.classList.add('color-transition'));
        [n.style.backgroundColor, colorButton.style.backgroundColor] = [color, color];
        setTimeout(() => [n, colorButton].forEach(el => el.classList.remove('color-transition')), 300);
    });
    lastNoteColors[currentBoardId] = color;
    saveActiveNotes();
}

/**
 * Toggles bold formatting for note content
 * @param {Element} button - The bold toggle button
 */
const toggleBold = button => {
    const content = button.closest('.sticky-note').querySelector('.sticky-content');
    [content.classList.toggle('bold'), button.classList.toggle('active')];
    saveActiveNotes();
};

/**
 * KEYBOARD SHORTCUT HANDLING
 */

// Create and manage keyboard shortcut indicator
const shortcutIcon = document.getElementById('shortcutIcon') || document.querySelector('.textarea-container').appendChild(Object.assign(document.createElement('div'), {className: 'shortcut-icon', id: 'shortcutIcon'}));

/**
 * Updates the shortcut icon based on platform
 */
const updateShortcutIcon = () => {
    shortcutIcon.textContent = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl';
};

// Setup shortcut icon
updateShortcutIcon();

// Handle keyboard shortcuts for note creation
document.querySelector('.note-input textarea').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) [e.preventDefault(), addNote()];
});
