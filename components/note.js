// Global state variables
let noteColumns = {}; // Tracks note columns for weekday/day patterns
let repositionedNotes = new Set(); // Stores IDs of manually repositioned notes
let hoveredBoardButton = null; // Tracks board button hover state for drag-and-drop
let dragTransferMessageVisible = false; // Tracks drag transfer message visibility
let globalZIndex = 1000; // Global z-index counter for note layering
let hoverDetectionDisabled = false; // Disables hover detection temporarily
let isDragInProgress = false; // Global drag state to prevent button hover interactions

// Utility functions
const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomOffset = () => (Math.random() * 40) - 20; // Random between -20 and 20
const getDayColumnIndex = (date = getCurrentDate()) => date.getDay() === 0 ? 0 : date.getDay() - 1; // 0=Mon, 5=Sat

// Note limit notification system
function showNoteLimitMessage(message) {
    const limitMessage = document.getElementById('noteLimitMessage');
    if (limitMessage) {
        const textElement = limitMessage.querySelector('.transfer-text');
        if (textElement) {
            textElement.textContent = message;
        }
        limitMessage.classList.add('visible');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            limitMessage.classList.remove('visible');
        }, 3000);
    }
}

// Open trash modal and shake clear button when limit reached
function openTrashDueToLimit() {
    const modal = document.getElementById('trashModal');
    const clearButton = document.querySelector('.clear-trash-btn');
    
    // Open trash modal
    if (modal && !modal.classList.contains('visible')) {
        modal.style.display = 'block';
        modal.classList.add('visible');
        if (typeof renderDeletedNotes === 'function') {
            renderDeletedNotes();
        }
    }
    
    // Shake the clear button
    if (clearButton) {
        clearButton.classList.add('shake-animation');
        setTimeout(() => {
            clearButton.classList.remove('shake-animation');
        }, 1000);
    }
}

// Note Creation and Management
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

    // Check note count limits (skip for pattern boards as they use position-based limits)
    if (!hasWeekdaysPattern && !hasDaysPattern) {
        const maxNotes = 30;
        if (notes.length >= maxNotes) {
            showNoteLimitMessage(`Maximum notes space reached.`);
            return;
        }
    }

    const lastAddedNote = notes[notes.length - 1];
    let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || { x: 0, y: 0 };
    let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
    let positionX, positionY;

    const calculateColumnPosition = (columnIndex, columnCount) => {
        const headerWidth = boardElement.offsetWidth / columnCount;
        const baseX = (columnIndex * headerWidth) + 10; // Start 10px from column left edge
        const maxX = (columnIndex + 1) * headerWidth - 210; // End 210px before column right edge (note width)
        return Math.max(baseX, Math.min(maxX, baseX + getRandomOffset()));
    };

    const getColumnNotes = (columnIndex, columnCount, excludeNote = null) => {
        // Use the same detection logic as the debug modal
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
        const columnStartX = columnIndex * columnWidth;
        const columnEndX = (columnIndex + 1) * columnWidth;
        
        console.log(`Checking column ${columnIndex}: startX=${columnStartX}, endX=${columnEndX}, width=${columnWidth}`);
        console.log(`Total notes to check: ${allNotes.length}`);
        
        const columnNotes = allNotes.filter(note => {
            // Use the stored position from style.left instead of getBoundingClientRect
            const noteLeft = parsePosition(note.style.left);
            const noteWidth = 200; // Standard note width
            const noteRight = noteLeft + noteWidth;
            
            // Calculate overlap with this column
            const overlapStart = Math.max(noteLeft, columnStartX);
            const overlapEnd = Math.min(noteRight, columnEndX);
            const overlapWidth = Math.max(0, overlapEnd - overlapStart);
            const overlapPercent = (overlapWidth / noteWidth);
            
            console.log(`Note at ${noteLeft}-${noteRight} (width: ${noteWidth}): overlap=${overlapWidth}, percent=${overlapPercent.toFixed(2)}`);
            
            // Note belongs to this column if more than 50% of it overlaps
            const belongs = overlapPercent > 0.5;
            if (belongs) {
                console.log(`✓ Note belongs to column ${columnIndex}`);
            }
            return belongs;
        });
        
        console.log(`Column ${columnIndex} has ${columnNotes.length} notes`);
        return columnNotes;
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

    if (hasNoNotes) {
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
        else {
            // Place first note more centered, not so far to the left
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
            [lastX, lastY, lastColor] = [parsePosition(lastAddedNote.style.left), parsePosition(lastAddedNote.style.top), lastAddedNote.style.backgroundColor];
            const positionResult = getNextNotePosition(lastX, lastY);
            if (positionResult.noSpace) {
                showNoteLimitMessage(`Maximum notes space reached.`);
                return;
            }
            ({ x: positionX, y: positionY } = positionResult);
        } else {
            const positionResult = getNextNotePosition(lastX, lastY);
            if (positionResult.noSpace) {
                showNoteLimitMessage(`Maximum notes space reached.`);
                return;
            }
            ({ x: positionX, y: positionY } = positionResult);
        }
        
        // If this is a new column (Y <= 50), create vertical break from existing notes
        if (positionY <= 50) {
            // Find notes in the same column area (within 100px horizontally)
            const notesInColumn = notes.filter(note => {
                const noteX = parsePosition(note.style.left);
                return Math.abs(noteX - positionX) < 100;
            });
            
            if (notesInColumn.length > 0) {
                // Check if there are notes from a different "section" (different colors or significant gap)
                let lowestY = 0;
                let hasOldNotes = false;
                
                notesInColumn.forEach(note => {
                    const noteY = parsePosition(note.style.top);
                    const noteColor = note.style.backgroundColor;
                    
                    // Check if this is an "old" note (different color from last added note)
                    if (noteColor !== lastColor && noteY < 250) {
                        hasOldNotes = true;
                    }
                    
                    if (noteY > lowestY) {
                        lowestY = noteY;
                    }
                });
                
                // Only create vertical break if there are old notes from different section
                if (hasOldNotes) {
                    positionY = lowestY + 200; // Create 200px vertical break below existing notes
                } else {
                    positionY = lowestY + 70; // Normal stacking for same section
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
    const note = document.createElement('div');
    const noteId = generateNoteId();
    
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

    setupNote(note);
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!boardElement) { console.error(`Board element with ID ${boardId} not found.`); return null; }
    
    boardElement.appendChild(note);
    note.style.animation = 'paperPop 0.3s ease-out forwards';
    if (!isRestored) saveActiveNotes();
    return note;
}

function setupNote(note) {
    let isDragging = false, isResizing = false, isEditing = false;
    let startX, startY, initialX, initialY, initialW, initialH, holdTimer;
    const [colorButton, colorPalette, content] = ['.color-button', '.color-palette', '.sticky-content'].map(s => note.querySelector(s));
    const saveContent = () => saveActiveNotes();
    
    [content.addEventListener('blur', saveContent), content.addEventListener('input', saveContent)];

    const cancelEditing = (e) => {
        if (isEditing && !content.contains(e.target)) {
            [isEditing, content.contentEditable] = [false, "false"];
            content.blur();
            document.removeEventListener('click', cancelEditing);
        }
    };

    content.addEventListener('dblclick', (e) => {
        [isEditing, content.contentEditable] = [true, "true"];
        
        // Use setTimeout to ensure the contenteditable is set before positioning cursor
        setTimeout(() => {
            // Set cursor position based on click location
            const range = document.createRange();
            const selection = window.getSelection();
            
            // Get the click position and set cursor there
            if (document.caretRangeFromPoint) {
                const clickRange = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (clickRange) {
                    selection.removeAllRanges();
                    selection.addRange(clickRange);
                }
            } else if (document.caretPositionFromPoint) {
                const caretPos = document.caretPositionFromPoint(e.clientX, e.clientY);
                if (caretPos) {
                    range.setStart(caretPos.offsetNode, caretPos.offset);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            
            content.focus();
        }, 0);
        
        setTimeout(() => document.addEventListener('click', cancelEditing), 0);
        e.stopPropagation();
    });

    // Add hover functionality to bring note to top temporarily
    let originalZIndex = null;
    let isHovering = false;
    
    note.addEventListener('mouseenter', () => {
        if (!isHovering) {
            originalZIndex = note.style.zIndex;
            note.style.zIndex = ++globalZIndex;
            isHovering = true;
        }
    });
    
    note.addEventListener('mouseleave', () => {
        if (isHovering && originalZIndex !== null) {
            note.style.zIndex = originalZIndex;
            isHovering = false;
        }
    });

    note.addEventListener('click', (e) => {
        if (!e.target.closest('.sticky-content[contenteditable="true"], .color-palette, .done-button, .bold-toggle, .resize-handle')) {
            // Permanently change z-index on click
            note.style.zIndex = ++globalZIndex;
            originalZIndex = note.style.zIndex; // Update the stored original z-index
            e.stopPropagation();
        }
    });

    content.addEventListener('blur', () => content.contentEditable = "false");
    content.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) { content.contentEditable = "false"; saveContent(); }
            else {
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                const newLine = Object.assign(document.createElement('span'), { 
                    innerHTML: '<br>', 
                    style: { fontFamily: "'Comic Neue', cursive" }
                });
                range.deleteContents();
                range.insertNode(newLine);
                range.setStartAfter(newLine);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    });

    const updateLastPosition = () => {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId] = { x: rect.left, y: rect.top };
    };

    let mouseX = 0, mouseY = 0, hoverTimeout = null;
    document.addEventListener('mousemove', (e) => {
        [mouseX, mouseY] = [e.clientX, e.clientY];
        document.querySelectorAll('.color-palette.visible').forEach(palette => {
            const rect = palette.getBoundingClientRect();
            const button = palette.closest('.note-controls')?.querySelector('.color-button');
            if (!button) return;
            const buttonRect = button.getBoundingClientRect();
            const isNearPalette = mouseX >= rect.left - 10 && mouseX <= rect.right + 10 && mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10;
            const isOverButton = mouseX >= buttonRect.left && mouseX <= buttonRect.right && mouseY >= buttonRect.top && mouseY <= buttonRect.bottom;
            if (isNearPalette || isOverButton) clearTimeout(hoverTimeout);
            else if (palette.classList.contains('visible')) hidePalette();
        });
    });

    const showPalette = () => {
        clearTimeout(hoverTimeout);
        colorPalette.classList.remove('closing');
        colorPalette.classList.add('visible');
        document.querySelectorAll('.color-palette').forEach(p => {
            if (p !== colorPalette) {
                p.classList.add('closing');
                setTimeout(() => p.classList.remove('visible', 'closing'), 180);
            }
        });
    };

    const hidePalette = () => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            const [rect, buttonRect] = [colorPalette.getBoundingClientRect(), colorButton.getBoundingClientRect()];
            const isMouseOutside = mouseX < rect.left - 10 || mouseX > rect.right + 10 || mouseY < rect.top - 10 || mouseY > rect.bottom + 10;
            const isMouseOverButton = mouseX >= buttonRect.left && mouseX <= buttonRect.right && mouseY >= buttonRect.top && mouseY <= buttonRect.bottom;
            if (isMouseOutside && !isMouseOverButton) {
                colorPalette.classList.add('closing');
                setTimeout(() => colorPalette.classList.contains('closing') && colorPalette.classList.remove('visible', 'closing'), 180);
            }
        }, 50);
    };

    colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        colorPalette.classList.contains('visible') ? hidePalette() : showPalette();
    });
    [colorPalette.addEventListener('mouseenter', () => clearTimeout(hoverTimeout)), colorPalette.addEventListener('mouseleave', hidePalette)];

    const handleInteractionStart = (e, clientX, clientY) => {
        if (e.target.closest('.color-palette, .done-button')) return;
        if (selectedNotes.includes(note) && selectedNotes.length > 1) { handleSelectionMove(e); return; }
        if (!e.shiftKey) clearSelection();
        else if (!selectedNotes.includes(note)) { selectedNotes.push(note); note.classList.add('selected'); }

        e.preventDefault();
        [document.body.style.userSelect, document.body.style.webkitUserSelect, note.style.zIndex] = ['none', 'none', ++globalZIndex];
        [startX, startY] = [clientX, clientY];
        
        if (e.target.closest('.resize-handle')) {
            [isResizing, initialW, initialH] = [true, note.offsetWidth, note.offsetHeight];
        } else {
            [initialX, initialY] = [parsePosition(note.style.left), parsePosition(note.style.top)];
            [note.dataset.originalX, note.dataset.originalY] = [initialX, initialY];
            holdTimer = setTimeout(() => isDragging = true, 150);
        }
        activeNote = note;
    };

    const handleInteractionMove = (clientX, clientY) => {
        if (!activeNote || activeNote !== note) return;
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) clearTimeout(holdTimer);

        if (isDragging) {
            if (!isDragInProgress) {
                isDragInProgress = true;
                document.body.classList.add('drag-in-progress');
            }
            const padding = 5;
            let [newX, newY] = [
                Math.min(Math.max(initialX + clientX - startX, -padding), window.innerWidth - (note.offsetWidth / 4)),
                Math.min(Math.max(initialY + clientY - startY, -padding), window.innerHeight - (note.offsetHeight / 4))
            ];
            [note.style.left, note.style.top] = [`${newX}px`, `${newY}px`];
            showDragTransferMessage();
            checkBoardButtonHover(clientX, clientY);
        }
        if (isResizing) {
            const [minW, minH] = [150, 150];
            const [maxW, maxH] = [window.innerWidth - parsePosition(note.style.left) + 50, window.innerHeight - parsePosition(note.style.top) + 50];
            note.style.width = `${Math.min(Math.max(initialW + clientX - startX, minW), maxW)}px`;
            note.style.height = `${Math.min(Math.max(initialH + clientY - startY, minH), maxH)}px`;
        }
    };

    const handleInteractionEnd = () => {
        clearTimeout(holdTimer);
        [document.body.style.userSelect, document.body.style.webkitUserSelect] = ['', ''];

        if (isDragging || isResizing) {
            if (isDragging) {
                hideDragTransferMessage();
                const dropResult = checkBoardButtonDrop();
                if (!dropResult.moved) {
                    updateLastPosition();
                    checkTrashCollision(note);
                    checkBottomCornerCollision(note);
                    const noteId = note.dataset.noteId || generateNoteId();
                    [note.dataset.noteId, note.dataset.repositioned] = [noteId, 'true'];
                    repositionedNotes.add(noteId);
                    updateBoardIndicators();
                    clearBoardButtonHover();
                    activeNote = null;
                }
                saveActiveNotes();
                // Clear global drag state
                isDragInProgress = false;
                document.body.classList.remove('drag-in-progress');
            }
        }
        [isDragging, isResizing] = [false, false];
        hideDragTransferMessage();
    };

    [
        ['mousedown', e => handleInteractionStart(e, e.clientX, e.clientY)],
        ['touchstart', e => handleInteractionStart(e, e.touches[0].clientX, e.touches[0].clientY), { passive: false }]
    ].forEach(([event, handler, options]) => note.addEventListener(event, handler, options));
    
    [
        ['mousemove', e => handleInteractionMove(e.clientX, e.clientY)],
        ['mouseup', handleInteractionEnd],
        ['touchmove', e => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY), { passive: false }],
        ['touchend', handleInteractionEnd]
    ].forEach(([event, handler, options]) => document.addEventListener(event, handler, options));
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

document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) hideAllColorPalettes();
});

function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    const notesToChange = note.classList.contains('selected') ? document.querySelectorAll('.sticky-note.selected') : [note];

    notesToChange.forEach(n => {
        const colorButton = n.querySelector('.color-button');
        [n, colorButton].forEach(el => el.classList.add('color-transition'));
        [n.style.backgroundColor, colorButton.style.backgroundColor] = [color, color];
        setTimeout(() => [n, colorButton].forEach(el => el.classList.remove('color-transition')), 300);
    });

    [lastNoteColors[currentBoardId]] = [color];
    saveActiveNotes();
}

function toggleBold(button) {
    const content = button.closest('.sticky-note').querySelector('.sticky-content');
    [content.classList.toggle('bold'), button.classList.toggle('active')];
    saveActiveNotes();
}

let shortcutIcon = document.getElementById('shortcutIcon') || 
    document.querySelector('.textarea-container').appendChild(
        Object.assign(document.createElement('div'), {
            className: 'shortcut-icon',
            id: 'shortcutIcon'
        })
    );

const updateShortcutIcon = () => {
    const isMobile = window.innerWidth <= 1024;
    [shortcutIcon.style.display, shortcutIcon.textContent] = [
        isMobile ? 'none' : 'block',
        isMobile ? '' : (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl')
    ];
};
[window.addEventListener('resize', updateShortcutIcon), updateShortcutIcon()];

document.querySelector('.note-input textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        [e.preventDefault(), addNote()];
    }
});

// Board button drag-and-drop functionality
function checkBoardButtonHover(clientX, clientY) {
    if (hoverDetectionDisabled) return;
    const statusBar = document.querySelector('.status-bar');
    if (!statusBar) return;
    
    const statusBarRect = statusBar.getBoundingClientRect();
    const [distanceX, distanceY] = [
        Math.max(0, Math.max(statusBarRect.left - clientX, clientX - statusBarRect.right)),
        Math.max(0, Math.max(statusBarRect.top - clientY, clientY - statusBarRect.bottom))
    ];
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    const [enterThreshold, exitThreshold, wasNearMenu] = [120, 80, hoveredBoardButton !== null];
    const isNearMenu = wasNearMenu ? (distance <= enterThreshold) : (distance <= exitThreshold);

    const findClosestButton = () => {
        let [closestButton, closestDistance] = [null, Infinity];
        document.querySelectorAll('.board-button:not(.disabled)').forEach(button => {
            const rect = button.getBoundingClientRect();
            const buttonDistance = Math.sqrt(Math.pow(clientX - (rect.left + rect.width / 2), 2) + Math.pow(clientY - (rect.top + rect.height / 2), 2));
            if (buttonDistance < closestDistance) [closestButton, closestDistance] = [button, buttonDistance];
        });
        return closestButton;
    };

    if (isNearMenu !== wasNearMenu) {
        if (isNearMenu) {
            const boardButtons = document.querySelectorAll('.board-button:not(.disabled)');
            hoveredBoardButton = findClosestButton();
            boardButtons.forEach(button => button.classList.add('drag-proximity'));
            if (hoveredBoardButton) hoveredBoardButton.classList.add('drag-hover');
            startHoverAnimation();
        } else {
            document.querySelectorAll('.board-button').forEach(button => button.classList.remove('drag-hover', 'drag-proximity'));
            [hoveredBoardButton] = [null];
            clearHoverAnimations();
        }
    } else if (isNearMenu && hoveredBoardButton) {
        const closestButton = findClosestButton();
        if (closestButton !== hoveredBoardButton) {
            hoveredBoardButton?.classList.remove('drag-hover');
            hoveredBoardButton = closestButton;
            if (closestButton) {
                closestButton.classList.add('drag-hover');
                hideDragTransferMessage();
                document.querySelector('.shortcut-hint')?.classList.add('hidden-during-drag');
            } else {
                showDragTransferMessage();
                if (!dragTransferMessageVisible) document.querySelector('.shortcut-hint')?.classList.remove('hidden-during-drag');
            }
        }
    }
}

function startHoverAnimation() {
    if (!hoveredBoardButton) return;
    const buttonRect = hoveredBoardButton.getBoundingClientRect();
    const notesToAnimate = selectedNotes.length > 0 ? selectedNotes : (activeNote ? [activeNote] : []);

    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
                textarea.style.userSelect = 'none';
                textarea.style.pointerEvents = 'none';
            });

            const noteRect = note.getBoundingClientRect();
            const boardRect = note.closest('.board').getBoundingClientRect();

            const targetX = (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2);
            const targetY = (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2);

            note.style.setProperty('--suckX', `${targetX}px`);
            note.style.setProperty('--suckY', `${targetY}px`);
            note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
            note.classList.add('hover-animating');
        }
    });
}

function clearHoverAnimations() {
    document.querySelectorAll('.hover-animating').forEach(note => {
        note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('pointer-events');
        });
        note.style.animation = 'noteSuckReverse 0.3s ease-out forwards';
        note.classList.remove('hover-animating');
        note.classList.add('reverse-animating');
        setTimeout(() => {
            if (note.classList.contains('reverse-animating')) {
                note.style.animation = 'none';
                note.style.removeProperty('--suckX');
                note.style.removeProperty('--suckY');
                note.classList.remove('reverse-animating');
            }
        }, 300);
    });
}

function showDragTransferMessage() {
    if (boardCount > 1 && !dragTransferMessageVisible && !hoveredBoardButton) {
        const transferMessage = document.getElementById('dragTransferMessage');
        if (transferMessage) {
            transferMessage.classList.add('visible');
            dragTransferMessageVisible = true;
        }
        document.querySelector('.shortcut-hint')?.classList.add('hidden-during-drag');
    }
}

function hideDragTransferMessage() {
    if (dragTransferMessageVisible) {
        const transferMessage = document.getElementById('dragTransferMessage');
        if (transferMessage) {
            transferMessage.classList.remove('visible');
            dragTransferMessageVisible = false;
        }
        document.querySelector('.shortcut-hint')?.classList.remove('hidden-during-drag');
    }
}

function clearBoardButtonHover() {
    document.querySelectorAll('.board-button').forEach(button => button.classList.remove('drag-hover', 'drag-proximity'));
    hoveredBoardButton = null;
    clearHoverAnimations();
    hideDragTransferMessage();
}

function checkBottomCornerCollision(note) {
    if (!note) return;
    const noteRect = note.getBoundingClientRect();
    const screenHeight = window.innerHeight;
    const restrictedWidth = 250, restrictedHeight = 150;
    const restrictedTop = screenHeight - restrictedHeight;

    const overlapsVertically = noteRect.bottom > restrictedTop;
    const overlapsBottomLeft = noteRect.left < restrictedWidth && overlapsVertically;

    if (overlapsBottomLeft) {
        const moveUpDistance = noteRect.bottom - restrictedTop + 20;
        const currentTop = parsePosition(note.style.top);
        const newTop = Math.max(60, currentTop - moveUpDistance);
        note.style.transition = 'top 0.3s ease-out';
        note.style.top = `${newTop}px`;
        setTimeout(() => note.style.transition = '', 300);
    }
}

function checkBoardButtonDrop() {
    if (!hoveredBoardButton) return { moved: false };

    const targetBoardId = parseInt(hoveredBoardButton.dataset.boardId);
    const notesToMove = selectedNotes.length > 0 ? [...selectedNotes] : [activeNote];

    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => {
            if (note) {
                note.style.top = `${parseInt(note.style.top || 0) - 250}px`;
            }
        });
        return { moved: false };
    }

    let relativePositions = new Map();
    if (notesToMove.length > 1 && typeof notesInitialPositions !== 'undefined' && notesInitialPositions.length > 0) {
        let minLeft = Infinity, minTop = Infinity;
        notesInitialPositions.forEach(notePos => {
            if (notePos && notesToMove.includes(notePos.element)) {
                minLeft = Math.min(minLeft, notePos.x);
                minTop = Math.min(minTop, notePos.y);
            }
        });
        notesInitialPositions.forEach(notePos => {
            if (notePos && notesToMove.includes(notePos.element)) {
                relativePositions.set(notePos.element, { offsetX: notePos.x - minLeft, offsetY: notePos.y - minTop });
            }
        });
    }

    notesToMove.forEach(note => {
        if (note) moveNoteToBoard(note, targetBoardId, relativePositions.size > 0 ? relativePositions.get(note) : null);
    });

    if (selectedNotes.length > 0) clearSelection();
    return { moved: true };
}

function moveNoteToBoard(note, targetBoardId, relativePosition = null) {
    const currentLeft = note.style.left;

    if (note.classList.contains('hover-animating')) {
        note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
        note.classList.remove('hover-animating');
    } else {
        const targetButton = document.querySelector(`.board-button[data-board-id="${targetBoardId}"]`);
        if (!targetButton) return;

        const buttonRect = targetButton.getBoundingClientRect();
        const noteRect = note.getBoundingClientRect();
        const boardRect = note.closest('.board').getBoundingClientRect();

        const targetX = (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2);
        const targetY = (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2);

        note.style.setProperty('--suckX', `${targetX}px`);
        note.style.setProperty('--suckY', `${targetY}px`);
        note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
        note.classList.add('hover-animating');
    }

    setTimeout(() => {
        if (note.classList.contains('hover-animating')) {
            note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
            note.classList.remove('hover-animating');
        }
    }, 300);

    setTimeout(() => {
        note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('pointer-events');
        });

        note.remove(); // Remove from current board

        const targetBoard = document.querySelector(`.board[data-board-id="${targetBoardId}"]`);
        if (targetBoard) {
            note.style.animation = '';
            note.style.removeProperty('--suckX');
            note.style.removeProperty('--suckY');

            if (relativePosition) {
                let originalPosition = notesInitialPositions?.find(pos => pos.element === note);
                if (originalPosition) {
                    note.style.left = `${originalPosition.x}px`;
                    note.style.top = `${Math.max(60, originalPosition.y)}px`;
                } else {
                    const baseLeft = 100, baseTop = 80;
                    note.style.left = `${baseLeft + relativePosition.offsetX}px`;
                    note.style.top = `${Math.max(60, baseTop + relativePosition.offsetY)}px`;
                }
            } else {
                const originalX = parseFloat(note.dataset.originalX);
                const originalY = parseFloat(note.dataset.originalY);
                if (!isNaN(originalX) && !isNaN(originalY)) {
                    note.style.left = `${originalX}px`;
                    note.style.top = `${Math.max(60, originalY)}px`;
                } else {
                    note.style.left = currentLeft;
                    note.style.top = '80px';
                }
            }

            const noteId = note.dataset.noteId || generateNoteId();
            note.dataset.noteId = noteId;
            repositionedNotes.add(noteId);
            note.dataset.repositioned = 'true';

            targetBoard.appendChild(note);
            note.style.animation = 'paperPop 0.3s ease-out forwards';

            updateBoardIndicators();
            clearBoardButtonHover();

            hoverDetectionDisabled = true;
            setTimeout(() => hoverDetectionDisabled = false, 500);

            const originalBoardId = currentBoardId;
            currentBoardId = targetBoardId;
            saveActiveNotes();
            currentBoardId = originalBoardId;
            saveActiveNotes();
        }
    }, 600);
}