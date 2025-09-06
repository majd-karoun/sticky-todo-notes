let noteColumns = {}, repositionedNotes = new Set();

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomOffset = () => (Math.random() * 40) - 20;
const getDayColumnIndex = (date = getCurrentDate()) => date.getDay() === 0 ? 0 : date.getDay() - 1;

function showNoteLimitMessage(message) {
    const limitMessage = document.getElementById('noteLimitMessage');
    const textElement = limitMessage?.querySelector('.transfer-text');
    if (textElement) textElement.textContent = message;
    if (limitMessage) {
        limitMessage.classList.add('visible');
        setTimeout(() => limitMessage.classList.remove('visible'), 3000);
    }
}

function openTrashDueToLimit() {
    const [modal, clearButton] = [document.getElementById('trashModal'), document.querySelector('.clear-trash-btn')];
    if (modal && !modal.classList.contains('visible')) {
        [modal.style.display, modal.classList] = ['block', modal.classList.add('visible')];
        if (typeof renderDeletedNotes === 'function') renderDeletedNotes();
    }
    if (clearButton) {
        clearButton.classList.add('shake-animation');
        setTimeout(() => clearButton.classList.remove('shake-animation'), 1000);
    }
}

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

    if (!hasWeekdaysPattern && !hasDaysPattern && notes.length >= 30) {
        showNoteLimitMessage(`Maximum notes space reached.`);
        return;
    }

    const lastAddedNote = notes[notes.length - 1];
    let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || { x: 0, y: 0 };
    let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
    let positionX, positionY;

    const calculateColumnPosition = (columnIndex, columnCount) => {
        const headerWidth = boardElement.offsetWidth / columnCount;
        const baseX = (columnIndex * headerWidth) + 10;
        const maxX = (columnIndex + 1) * headerWidth - 210;
        return Math.max(baseX, Math.min(maxX, baseX + getRandomOffset()));
    };

    const getColumnNotes = (columnIndex, columnCount, excludeNote = null) => {
        const noteSelectors = ['.note', '.sticky-note', '[class*="note"]', 'div[draggable="true"]'];
        let allNotes = [];
        for (const selector of noteSelectors) {
            const found = Array.from(boardElement.querySelectorAll(selector));
            if (found.length > 0) {
                allNotes = found.filter(note => note.style.display !== 'none' && note !== excludeNote);
                break;
            }
        }
        
        const columnWidth = boardElement.offsetWidth / columnCount;
        const [columnStartX, columnEndX] = [columnIndex * columnWidth, (columnIndex + 1) * columnWidth];
        
        return allNotes.filter(note => {
            const [noteLeft, noteWidth, noteRight] = [parsePosition(note.style.left), 200, parsePosition(note.style.left) + 200];
            const [overlapStart, overlapEnd] = [Math.max(noteLeft, columnStartX), Math.min(noteRight, columnEndX)];
            return Math.max(0, overlapEnd - overlapStart) / noteWidth > 0.5;
        });
    };

    const setColumnNotePosition = (columnIndex, columnCount) => {
        const columnNotes = getColumnNotes(columnIndex, columnCount);
        console.log(`setColumnNotePosition: Column ${columnIndex} has ${columnNotes.length} notes`);
        
        let lastYInColumn = 60, lastNoteInColumn = null;
        columnNotes.forEach(note => {
            const noteY = parsePosition(note.style.top);
            console.log(`Note Y position: ${noteY}, current lastY: ${lastYInColumn}`);
            if (noteY >= lastYInColumn) { 
                lastYInColumn = noteY; 
                lastNoteInColumn = note; 
                console.log(`Updated lastY to: ${lastYInColumn}`);
            }
        });
        
        // Use 300px bottom threshold for line breaking
        const bottomThreshold = window.innerHeight - 300;
        
        // Calculate new Y position
        let newY = lastNoteInColumn ? lastYInColumn + 70 : 60;
        
        // Always set positionX for this column first
        positionX = calculateColumnPosition(columnIndex, columnCount);
        
        // Check if new position would exceed bottom threshold
        if (newY > bottomThreshold) {
            // Column is full based on position, move to next column
            positionY = 60; // Will be overridden by overflow logic
        } else {
            // Place note after the last note in column
            positionY = newY;
            // Set color based on the last note in column (inherit color)
            if (lastNoteInColumn) {
                lastColor = lastNoteInColumn.style.backgroundColor;
                console.log(`Inheriting color from last note: ${lastColor}`);
            }
            return true; // Success - note can be placed in this column
        }
        
        
        // If the column is full (based on position threshold), move to next column
        if (newY > bottomThreshold) {
            console.log(`Column ${columnIndex} is full (position ${newY} > threshold ${bottomThreshold}), looking for next column...`);
            
            // Find the next available column (cycling through all columns)
            let nextColumnIndex = (columnIndex + 1) % columnCount;
            let attempts = 0;
            
            // Look for columns with space (empty or last note not at threshold)
            let foundAvailableColumn = false;
            while (attempts < columnCount) {
                console.log(`Checking column ${nextColumnIndex} (attempt ${attempts + 1})`);
                const nextColumnNotes = getColumnNotes(nextColumnIndex, columnCount, null);
                
                // Check if this column has space (based on position threshold)
                let nextColumnLastY = 60;
                nextColumnNotes.forEach(note => {
                    const noteY = parsePosition(note.style.top);
                    if (noteY >= nextColumnLastY) { 
                        nextColumnLastY = noteY;
                    }
                });
                const nextColumnNewY = nextColumnNotes.length > 0 ? nextColumnLastY + 70 : 60;
                console.log(`Column ${nextColumnIndex} next position would be ${nextColumnNewY}, threshold is ${bottomThreshold}`);
                
                if (nextColumnNewY <= bottomThreshold) {
                    // This column has space
                    console.log(`Using column ${nextColumnIndex} with space`);
                    columnIndex = nextColumnIndex;
                    positionX = calculateColumnPosition(nextColumnIndex, columnCount);
                    
                    if (nextColumnNotes.length === 0) {
                        // Empty column - start at top
                        newY = 60;
                        positionY = newY;
                    } else {
                        // Find last note and place after it
                        let nextColumnLastY = 60;
                        let nextColumnLastNote = null;
                        nextColumnNotes.forEach(note => {
                            const noteY = parsePosition(note.style.top);
                            if (noteY >= nextColumnLastY) { 
                                nextColumnLastY = noteY; 
                                nextColumnLastNote = note;
                            }
                        });
                        newY = nextColumnLastY + 70;
                        positionY = newY;
                        
                        // Inherit color from the last note in this column
                        if (nextColumnLastNote) {
                            lastColor = nextColumnLastNote.style.backgroundColor;
                            console.log(`Inheriting color from last note in next column: ${lastColor}`);
                        }
                    }
                    
                    foundAvailableColumn = true;
                    break;
                } else {
                    // This column is full, try next one
                    console.log(`Column ${nextColumnIndex} is full (position threshold exceeded), trying next...`);
                    nextColumnIndex = (nextColumnIndex + 1) % columnCount;
                    attempts++;
                }
            }
            
            // If no available columns found, show limit message
            if (!foundAvailableColumn) {
                console.log(`No available columns found, showing limit message`);
                showNoteLimitMessage(`Maximum notes space reached.`);
                return false; // Return false to indicate failure
            }
        }
    };

    const handlePatternPositioning = (isWeekday) => {
        if (isWeekday) {
            return setColumnNotePosition(getDayColumnIndex(), 6);
        } else {
            const dayNumber = getCurrentDayNumber(currentBoardId);
            return setColumnNotePosition(dayNumber === -1 ? 0 : dayNumber, 5);
        }
    };

    if (hasNoNotes) {
        if (hasWeekdaysPattern || hasDaysPattern) {
            if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
        } else {
            positionX = Math.max(150, window.innerWidth / 4);
            positionY = 50;
        }
    } else if (hasWeekdaysPattern || hasDaysPattern) {
        // Always use column positioning for pattern modes, ignore repositioned notes
        if (hasWeekdaysPattern) {
            const result = setColumnNotePosition(getDayColumnIndex(), 6);
            if (result === false) return;
        }
        else if (hasDaysPattern) {
            const dayNumber = getCurrentDayNumber(currentBoardId);
            const columnIndex = dayNumber === -1 ? 0 : dayNumber;
            const result = setColumnNotePosition(columnIndex, 5);
            if (result === false) return;
        }
    } else {
        // For regular boards, use line-breaking logic with vertical breaks
        if (lastAddedNote) {
            // Always use the actual position of the last added note (which could be repositioned)
            [lastX, lastY, lastColor] = [parsePosition(lastAddedNote.style.left), parsePosition(lastAddedNote.style.top), lastAddedNote.style.backgroundColor];
            const positionResult = getNextNotePosition(lastX, lastY);
            ({ x: positionX, y: positionY } = positionResult);
        } else {
            const positionResult = getNextNotePosition(lastX, lastY);
            ({ x: positionX, y: positionY } = positionResult);
        }
        
        // If this is a new row (Y <= 50), create vertical break from existing notes
        if (positionY <= 50) {
            // Find notes in the same column area (within 150px horizontally)
            const notesInColumn = notes.filter(note => {
                const noteX = parsePosition(note.style.left);
                return Math.abs(noteX - positionX) < 150;
            });
            
            if (notesInColumn.length > 0) {
                // Find the lowest and highest Y positions among existing notes in this column
                let lowestY = 0;
                let highestY = window.innerHeight;
                notesInColumn.forEach(note => {
                    const noteY = parsePosition(note.style.top);
                    if (noteY > lowestY) {
                        lowestY = noteY;
                    }
                    if (noteY < highestY) {
                        highestY = noteY;
                    }
                });
                
                // Check if placing the note below would exceed the bottom threshold
                const bottomThreshold = window.innerHeight - 300;
                const proposedY = lowestY + 200;
                const proposedUpwardY = highestY - 200;
                
                if (proposedY > bottomThreshold) {
                    // Check if there's space above
                    if (proposedUpwardY >= 50) {
                        // Break upward - place above the highest note with spacing
                        positionY = proposedUpwardY;
                    } else {
                        // No space above or below - systematically check all columns for space
                        const maxX = window.innerWidth - 200;
                        const columnWidth = 250;
                        let foundSpace = false;
                        let testX = positionX + columnWidth;
                        
                        // Check columns to the right first
                        while (testX <= maxX && !foundSpace) {
                            const testColumnNotes = notes.filter(note => {
                                const noteX = parsePosition(note.style.left);
                                return Math.abs(noteX - testX) < 150;
                            });
                            
                            if (testColumnNotes.length === 0) {
                                // Empty column found
                                positionX = testX;
                                positionY = 50;
                                foundSpace = true;
                            } else {
                                // Check if this column has space above or below
                                let testLowestY = 0;
                                let testHighestY = window.innerHeight;
                                testColumnNotes.forEach(note => {
                                    const noteY = parsePosition(note.style.top);
                                    if (noteY > testLowestY) testLowestY = noteY;
                                    if (noteY < testHighestY) testHighestY = noteY;
                                });
                                
                                const testProposedY = testLowestY + 200;
                                const testProposedUpwardY = testHighestY - 200;
                                
                                if (testProposedY <= bottomThreshold) {
                                    // Space below found
                                    positionX = testX;
                                    positionY = testProposedY;
                                    foundSpace = true;
                                } else if (testProposedUpwardY >= 50) {
                                    // Space above found
                                    positionX = testX;
                                    positionY = testProposedUpwardY;
                                    foundSpace = true;
                                }
                            }
                            
                            if (!foundSpace) testX += columnWidth;
                        }
                        
                        // If no space found to the right, check from the left
                        if (!foundSpace) {
                            testX = 55; // Start from far left
                            while (testX < positionX && !foundSpace) {
                                const testColumnNotes = notes.filter(note => {
                                    const noteX = parsePosition(note.style.left);
                                    return Math.abs(noteX - testX) < 150;
                                });
                                
                                if (testColumnNotes.length === 0) {
                                    // Empty column found
                                    positionX = testX;
                                    positionY = 50;
                                    foundSpace = true;
                                } else {
                                    // Check if this column has space above or below
                                    let testLowestY = 0;
                                    let testHighestY = window.innerHeight;
                                    testColumnNotes.forEach(note => {
                                        const noteY = parsePosition(note.style.top);
                                        if (noteY > testLowestY) testLowestY = noteY;
                                        if (noteY < testHighestY) testHighestY = noteY;
                                    });
                                    
                                    const testProposedY = testLowestY + 200;
                                    const testProposedUpwardY = testHighestY - 200;
                                    
                                    if (testProposedY <= bottomThreshold) {
                                        // Space below found
                                        positionX = testX;
                                        positionY = testProposedY;
                                        foundSpace = true;
                                    } else if (testProposedUpwardY >= 50) {
                                        // Space above found
                                        positionX = testX;
                                        positionY = testProposedUpwardY;
                                        foundSpace = true;
                                    }
                                }
                                
                                if (!foundSpace) testX += columnWidth;
                            }
                        }
                        
                        // If still no space found anywhere, show limit message
                        if (!foundSpace) {
                            showNoteLimitMessage(`Maximum notes space reached.`);
                            return;
                        }
                    }
                } else {
                    // Normal downward break
                    positionY = proposedY;
                }
            }
        }
    }

    createNote(text.replace(/\n/g, '<br>'), lastColor, positionX, positionY, false, '200px', '150px', false, currentBoardId);
    [lastNotePositions[currentBoardId], lastNoteColors[currentBoardId], textarea.value] = [{ x: positionX, y: positionY }, lastColor, ''];
    saveActiveNotes();
    updateBoardIndicators();
}

function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId, repositioned = false) {
    const [note, noteId] = [document.createElement('div'), generateNoteId()];
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
    
    note.style.cssText = `background-color:${color}; left:${x}px; top:${y}px; width:${width}; height:${height}; z-index:${++globalZIndex};`;
    note.dataset.noteId = noteId;
    if (repositioned) { note.dataset.repositioned = 'true'; repositionedNotes.add(noteId); }
    
    // Store initial z-index for this note
    noteZIndexes[noteId] = globalZIndex;
    saveNoteZIndexes();

    // Add click handler to bring note to front
    note.addEventListener('click', (e) => {
        // Don't trigger on control buttons or content editing
        if (!e.target.closest('.note-controls, .sticky-content[contenteditable="true"]')) {
            bringNoteToFront(note);
        }
    });

    setupNote(note);
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!boardElement) { console.error(`Board element with ID ${boardId} not found.`); return null; }
    
    boardElement.appendChild(note);
    note.style.animation = 'paperPop 0.3s ease-out forwards';
    if (!isRestored) saveActiveNotes();
    return note;
}

// Color and styling functions
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

const toggleBold = button => {
    const content = button.closest('.sticky-note').querySelector('.sticky-content');
    [content.classList.toggle('bold'), button.classList.toggle('active')];
    saveActiveNotes();
};

// Keyboard shortcut handling
const shortcutIcon = document.getElementById('shortcutIcon') || document.querySelector('.textarea-container').appendChild(Object.assign(document.createElement('div'), {className: 'shortcut-icon', id: 'shortcutIcon'}));
const updateShortcutIcon = () => {
    const isMobile = window.innerWidth <= 1024;
    [shortcutIcon.style.display, shortcutIcon.textContent] = [isMobile ? 'none' : 'block', isMobile ? '' : (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl')];
};
[window.addEventListener('resize', updateShortcutIcon), updateShortcutIcon()];

document.querySelector('.note-input textarea').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) [e.preventDefault(), addNote()];
});
