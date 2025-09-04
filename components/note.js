// Track note columns for weekday patterns
let noteColumns = {};

// Track repositioned notes that should use normal logic
let repositionedNotes = new Set();

// Track board button hover state for drag-and-drop
let hoveredBoardButton = null;

// Track drag transfer message visibility
let dragTransferMessageVisible = false;

// Global z-index counter for proper note layering
let globalZIndex = 1000;

// Function to generate unique note ID
function generateNoteId(note) {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Function to get a random offset for natural positioning
function getRandomOffset() {
    return (Math.random() * 40) - 20; // Random value between -20 and 20
}

// Function to get the column index based on date (0-5 for Monday-Saturday)
function getDayColumnIndex(date = getCurrentDate()) {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (day === 0) return 0;  // Sunday -> Monday's column
    return day - 1;           // Monday(1) -> 0, Tuesday(2) -> 1, ..., Saturday(6) -> 5
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
            const columnIndex = getCurrentDayNumber(currentBoardId);
            const boardWidth = boardElement.offsetWidth;
            const headerWidth = boardWidth / 5;
            
            // Calculate base position for the current day column
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
        // Check if any note on this board was repositioned
        const hasRepositionedNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).some(note => note.dataset.repositioned === 'true');
        
        if (hasRepositionedNotes && lastAddedNote) {
            // Use existing normal logic from all boards
            lastX = parsePosition(lastAddedNote.style.left);
            lastY = parsePosition(lastAddedNote.style.top);
            lastColor = lastAddedNote.style.backgroundColor;
            ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));
        } else {
            const boardRect = boardElement.getBoundingClientRect();
            const boardWidth = boardRect.width;
            const columnWidth = boardWidth / 6; // 6 columns for 6 weekdays
            
            // Determine column based on current date
            const columnIndex = getDayColumnIndex();
            
            // Initialize column if it doesn't exist
            if (!noteColumns[columnIndex]) {
                noteColumns[columnIndex] = [];
            }
            
            // Get all notes in this column (excluding repositioned ones)
            const columnNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).filter(note => {
                if (note.dataset.repositioned === 'true') return false;
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
            
            // Use the last note's color from this column if it exists
            if (lastNoteInColumn) {
                lastColor = lastNoteInColumn.style.backgroundColor;
            } else if (lastAddedNote) {
                lastColor = lastAddedNote.style.backgroundColor;
            }
        }
    } else if (hasDaysPattern) {
        // Check if any note on this board was repositioned
        const hasRepositionedNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).some(note => note.dataset.repositioned === 'true');
        
        if (hasRepositionedNotes && lastAddedNote) {
            // Use existing normal logic from all boards
            lastX = parsePosition(lastAddedNote.style.left);
            lastY = parsePosition(lastAddedNote.style.top);
            lastColor = lastAddedNote.style.backgroundColor;
            ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));
        } else {
            const boardRect = boardElement.getBoundingClientRect();
            const boardWidth = boardRect.width;
            const columnWidth = boardWidth / 5; // 5 columns for 5 days
            
            // Determine column based on current day number
            const columnIndex = getCurrentDayNumber(currentBoardId);
            
            // Initialize column if it doesn't exist
            if (!noteColumns[columnIndex]) {
                noteColumns[columnIndex] = [];
            }
            
            // Get all notes in this column (excluding repositioned ones)
            const columnNotes = Array.from(boardElement.querySelectorAll('.sticky-note')).filter(note => {
                if (note.dataset.repositioned === 'true') return false;
                const noteRect = note.getBoundingClientRect();
                const noteCenterX = noteRect.left + (noteRect.width / 2) - boardRect.left;
                const noteColumn = Math.min(4, Math.max(0, Math.floor(noteCenterX / columnWidth)));
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
            
            // Use the last note's color from this column if it exists
            if (lastNoteInColumn) {
                lastColor = lastNoteInColumn.style.backgroundColor;
            } else if (lastAddedNote) {
                lastColor = lastAddedNote.style.backgroundColor;
            }
        }
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

function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId, repositioned = false) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    // Set z-index for new notes to bring them to the front
    globalZIndex++;
    note.style.cssText = `background-color:${color}; left:${typeof x === 'number' ? x+'px' : x}; top:${typeof y === 'number' ? y+'px' : y}; width:${width}; height:${height}; z-index:${globalZIndex};`;
    
    // Generate and assign note ID
    const noteId = generateNoteId(note);
    note.dataset.noteId = noteId;
    
    // Mark as repositioned if specified
    if (repositioned) {
        note.dataset.repositioned = 'true';
        repositionedNotes.add(noteId);
    }
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
    content.addEventListener('click', (e) => {
        if (!isEditing) {
            isEditing = true;
            content.contentEditable = "true"; 
            content.focus();
            // Select all text for easier editing
            const range = document.createRange();
            range.selectNodeContents(content);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            setTimeout(() => document.addEventListener('click', cancelEditing), 0);
            e.stopPropagation(); // Prevent triggering parent click handlers
        }
    });

    // Add click handler to bring note to front when clicked anywhere on the note
    note.addEventListener('click', (e) => {
        // Don't interfere with editing or control interactions
        if (e.target.closest('.sticky-content[contenteditable="true"]') || 
            e.target.closest('.color-palette') || 
            e.target.closest('.done-button') ||
            e.target.closest('.bold-toggle') ||
            e.target.closest('.resize-handle')) {
            return;
        }
        
        // Bring note to front
        globalZIndex++;
        note.style.zIndex = globalZIndex;
        e.stopPropagation();
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

    // Track mouse position for palette hover behavior
let mouseX = 0;
let mouseY = 0;
let hoverTimeout = null;

// Track mouse position and manage palette visibility
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Check all visible palettes
    document.querySelectorAll('.color-palette.visible').forEach(palette => {
        const rect = palette.getBoundingClientRect();
        const padding = 10; // Reduced padding for more precise control
        const button = palette.closest('.note-controls')?.querySelector('.color-button');
        
        if (!button) return;
        
        const buttonRect = button.getBoundingClientRect();
        
        // Check if mouse is near the palette or its button
        const isNearPalette = mouseX >= rect.left - padding && 
                            mouseX <= rect.right + padding && 
                            mouseY >= rect.top - padding && 
                            mouseY <= rect.bottom + padding;
                            
        const isOverButton = mouseX >= buttonRect.left && 
                           mouseX <= buttonRect.right && 
                           mouseY >= buttonRect.top && 
                           mouseY <= buttonRect.bottom;
        
        if (isNearPalette || isOverButton) {
            // Keep palette open if mouse is near it or over its button
            clearTimeout(hoverTimeout);
        } else if (palette.classList.contains('visible')) {
            // If palette is visible but mouse is not near it or its button, start hiding
            hidePalette();
        }
    });
});

// Show/hide palette on hover with proximity detection
const showPalette = () => {
    clearTimeout(hoverTimeout);
    // Remove closing class if it exists
    if (colorPalette.classList.contains('closing')) {
        colorPalette.classList.remove('closing');
    }
    colorPalette.classList.add('visible');
    // Hide other palettes
    document.querySelectorAll('.color-palette').forEach(p => {
        if (p !== colorPalette) {
            p.classList.add('closing');
            setTimeout(() => {
                p.classList.remove('visible', 'closing');
            }, 180);
        }
    });
};

const hidePalette = () => {
    // Clear any existing timeouts to prevent multiple triggers
    clearTimeout(hoverTimeout);
    
    // Start a new timeout to check if we should close
    hoverTimeout = setTimeout(() => {
        const rect = colorPalette.getBoundingClientRect();
        const padding = 10; // Reduced from 20px to make it less sticky
        
        // Check if mouse is outside the extended area
        const isMouseOutside = mouseX < rect.left - padding || 
                             mouseX > rect.right + padding || 
                             mouseY < rect.top - padding || 
                             mouseY > rect.bottom + padding;
        
        // Also check if mouse is not over the color button
        const buttonRect = colorButton.getBoundingClientRect();
        const isMouseOverButton = mouseX >= buttonRect.left && 
                                mouseX <= buttonRect.right && 
                                mouseY >= buttonRect.top && 
                                mouseY <= buttonRect.bottom;
        
        if (isMouseOutside && !isMouseOverButton) {
            // Add closing class and remove visible after animation
            colorPalette.classList.add('closing');
            setTimeout(() => {
                if (colorPalette.classList.contains('closing')) {
                    colorPalette.classList.remove('visible', 'closing');
                }
            }, 180);
        }
    }, 50); // Reduced delay for more responsive closing
};

// Show palette on button click
colorButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (colorPalette.classList.contains('visible')) {
        // If already visible, hide it
        hidePalette();
    } else {
        // Show the palette
        showPalette();
    }
});

// Keep palette open when hovering over it
colorPalette.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
});

// Hide palette when leaving it (with proximity check)
colorPalette.addEventListener('mouseleave', hidePalette);

    const handleInteractionStart = (e, clientX, clientY) => {
        if (e.target.closest('.color-palette, .done-button')) return;
        if (selectedNotes.includes(note) && selectedNotes.length > 1) { handleSelectionMove(e); return; }
        if (!e.shiftKey) clearSelection();
        else if (!selectedNotes.includes(note)) { selectedNotes.push(note); note.classList.add('selected'); }

        // Prevent text selection during drag
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';

        // Bring note to front by incrementing z-index when starting interaction
        globalZIndex++;
        note.style.zIndex = globalZIndex;

        startX = clientX; startY = clientY;
        if (e.target.closest('.resize-handle')) {
            isResizing = true; initialW = note.offsetWidth; initialH = note.offsetHeight;
        } else {
            initialX = parsePosition(note.style.left); initialY = parsePosition(note.style.top);
            holdTimer = setTimeout(() => { isDragging = true; }, 150);
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
            
            // Show transfer message if multiple boards exist and not already shown
            showDragTransferMessage();
            
            // Check for board button hover during drag
            checkBoardButtonHover(clientX, clientY);
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
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        
        if (isDragging || isResizing) {
            if (isDragging) { 
                // Hide transfer message when drag ends
                hideDragTransferMessage();
                
                // Check for board drop before other operations
                const dropResult = checkBoardButtonDrop();
                if (!dropResult.moved) {
                    updateLastPosition(); 
                    checkTrashCollision(note);
                    // Mark note as repositioned when manually dragged
                    let noteId = note.dataset.noteId;
                    if (!noteId) {
                        noteId = generateNoteId(note);
                        note.dataset.noteId = noteId;
                    }
                    repositionedNotes.add(noteId);
                    note.dataset.repositioned = 'true';
                    // Update board indicators
                    updateBoardIndicators();
                    
                    // Clear board button hover effects after transfer
                    clearBoardButtonHover();
                    
                    // Clear activeNote after successful transfer
                    activeNote = null;
                }
                saveActiveNotes();
            }
        }
        isDragging = false; isResizing = false;
        
        // Hide transfer message if drag ended without successful transfer
        hideDragTransferMessage();
        
        // Don't clear activeNote here - it's needed for board drop detection
    };

    note.addEventListener('mousedown', e => handleInteractionStart(e, e.clientX, e.clientY));
document.addEventListener('mousemove', e => handleInteractionMove(e.clientX, e.clientY));
document.addEventListener('mouseup', handleInteractionEnd);
note.addEventListener('touchstart', e => handleInteractionStart(e, e.touches[0].clientX, e.touches[0].clientY), { passive: false });
document.addEventListener('touchmove', e => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
document.addEventListener('touchend', handleInteractionEnd);
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
        // Add transition class for smooth color change
        n.classList.add('color-transition');
        n.querySelector('.color-button').classList.add('color-transition');
        
        // Apply the new color
        n.style.backgroundColor = color;
        n.querySelector('.color-button').style.backgroundColor = color;
        
        // Remove transition class after animation completes
        setTimeout(() => {
            n.classList.remove('color-transition');
            n.querySelector('.color-button').classList.remove('color-transition');
        }, 300); // Match this with the CSS transition duration
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

// Board button drag-and-drop functionality
function checkBoardButtonHover(clientX, clientY) {
    const statusBar = document.querySelector('.status-bar');
    if (!statusBar) return;
    
    const statusBarRect = statusBar.getBoundingClientRect();
    
    // Calculate distance from mouse to closest edge of status bar
    const distanceX = Math.max(0, Math.max(statusBarRect.left - clientX, clientX - statusBarRect.right));
    const distanceY = Math.max(0, Math.max(statusBarRect.top - clientY, clientY - statusBarRect.bottom));
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // Use hysteresis to prevent flickering - different thresholds for entering and exiting
    const enterThreshold = 120; // Larger threshold to enter
    const exitThreshold = 80;   // Smaller threshold to exit
    
    const wasNearMenu = hoveredBoardButton !== null;
    const isNearMenu = wasNearMenu ? (distance <= enterThreshold) : (distance <= exitThreshold);
    
    // Update hover state
    if (isNearMenu !== wasNearMenu) {
        if (isNearMenu) {
            // Find closest button for drop targeting
            const boardButtons = document.querySelectorAll('.board-button:not(.disabled)');
            let closestButton = null;
            let closestDistance = Infinity;
            
            boardButtons.forEach(button => {
                const rect = button.getBoundingClientRect();
                const buttonCenterX = rect.left + (rect.width / 2);
                const buttonCenterY = rect.top + (rect.height / 2);
                
                const buttonDistance = Math.sqrt(
                    Math.pow(clientX - buttonCenterX, 2) + 
                    Math.pow(clientY - buttonCenterY, 2)
                );
                
                if (buttonDistance < closestDistance) {
                    closestButton = button;
                    closestDistance = buttonDistance;
                }
            });
            
            hoveredBoardButton = closestButton;
            
            // Scale all board buttons uniformly
            boardButtons.forEach(button => {
                button.classList.add('drag-proximity');
            });
            
            // Add hover effect to closest button
            if (closestButton) {
                closestButton.classList.add('drag-hover');
            }
            
            // Start hover animation on dragged notes
            startHoverAnimation();
        } else {
            // Clear all effects
            const boardButtons = document.querySelectorAll('.board-button');
            boardButtons.forEach(button => {
                button.classList.remove('drag-hover', 'drag-proximity');
            });
            
            hoveredBoardButton = null;
            clearHoverAnimations();
        }
    } else if (isNearMenu && hoveredBoardButton) {
        // Update which button is the closest for drop targeting
        const boardButtons = document.querySelectorAll('.board-button:not(.disabled)');
        let closestButton = null;
        let closestDistance = Infinity;
        
        boardButtons.forEach(button => {
            const rect = button.getBoundingClientRect();
            const buttonCenterX = rect.left + (rect.width / 2);
            const buttonCenterY = rect.top + (rect.height / 2);
            
            const buttonDistance = Math.sqrt(
                Math.pow(clientX - buttonCenterX, 2) + 
                Math.pow(clientY - buttonCenterY, 2)
            );
            
            if (buttonDistance < closestDistance) {
                closestButton = button;
                closestDistance = buttonDistance;
            }
        });
        
        // Update hover highlight on closest button
        if (closestButton !== hoveredBoardButton) {
            if (hoveredBoardButton) {
                hoveredBoardButton.classList.remove('drag-hover');
            }
            hoveredBoardButton = closestButton;
            if (closestButton) {
                closestButton.classList.add('drag-hover');
            }
        }
    }
}

function startHoverAnimation() {
    if (!hoveredBoardButton) return;
    
    const targetBoardId = parseInt(hoveredBoardButton.dataset.boardId);
    
    const buttonRect = hoveredBoardButton.getBoundingClientRect();
    const notesToAnimate = selectedNotes.length > 0 ? selectedNotes : (activeNote ? [activeNote] : []);
    
    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            // Disable text selection during drag
            const textareas = note.querySelectorAll('textarea, [contenteditable]');
            textareas.forEach(textarea => {
                textarea.style.userSelect = 'none';
                textarea.style.webkitUserSelect = 'none';
                textarea.style.mozUserSelect = 'none';
                textarea.style.msUserSelect = 'none';
                textarea.style.pointerEvents = 'none';
            });
            
            const noteRect = note.getBoundingClientRect();
            const boardRect = note.closest('.board').getBoundingClientRect();
            
            // Calculate relative positions within the board
            const noteRelativeX = noteRect.left - boardRect.left;
            const noteRelativeY = noteRect.top - boardRect.top;
            const buttonRelativeX = buttonRect.left - boardRect.left + (buttonRect.width / 2);
            const buttonRelativeY = buttonRect.top - boardRect.top + (buttonRect.height / 2);
            
            const targetX = buttonRelativeX - noteRelativeX - (noteRect.width / 2);
            const targetY = buttonRelativeY - noteRelativeY - (noteRect.height / 2);
            
            note.style.setProperty('--suckX', `${targetX}px`);
            note.style.setProperty('--suckY', `${targetY}px`);
            note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
            note.classList.add('hover-animating');
        }
    });
}

function clearHoverAnimations() {
    const animatingNotes = document.querySelectorAll('.hover-animating');
    animatingNotes.forEach(note => {
        // Re-enable text selection when clearing hover
        const textareas = note.querySelectorAll('textarea, [contenteditable]');
        textareas.forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('-webkit-user-select');
            textarea.style.removeProperty('-moz-user-select');
            textarea.style.removeProperty('-ms-user-select');
            textarea.style.removeProperty('pointer-events');
        });
        
        // Play reverse animation instead of abrupt reset
        note.style.animation = 'noteSuckReverse 0.3s ease-out forwards';
        note.classList.remove('hover-animating');
        note.classList.add('reverse-animating'); // Prevent re-triggering
        
        // Clean up after reverse animation completes
        setTimeout(() => {
            // Only clean up if still reverse-animating (not interrupted)
            if (note.classList.contains('reverse-animating')) {
                note.style.animation = 'none'; // Explicitly disable any animation
                note.style.removeProperty('--suckX');
                note.style.removeProperty('--suckY');
                note.classList.remove('reverse-animating');
            }
        }, 300);
    });
}

function showDragTransferMessage() {
    // Only show if there are multiple boards and message isn't already visible
    if (boardCount > 1 && !dragTransferMessageVisible) {
        const transferMessage = document.getElementById('dragTransferMessage');
        if (transferMessage) {
            transferMessage.classList.add('visible');
            dragTransferMessageVisible = true;
        }
        
        // Hide shortcut hint while dragging
        const shortcutHint = document.querySelector('.shortcut-hint');
        if (shortcutHint) {
            shortcutHint.classList.add('hidden-during-drag');
        }
    }
}

function hideDragTransferMessage() {
    if (dragTransferMessageVisible) {
        const transferMessage = document.getElementById('dragTransferMessage');
        if (transferMessage) {
            transferMessage.classList.remove('visible');
            dragTransferMessageVisible = false;
        }
        
        // Show shortcut hint again when drag ends
        const shortcutHint = document.querySelector('.shortcut-hint');
        if (shortcutHint) {
            shortcutHint.classList.remove('hidden-during-drag');
        }
    }
}

function clearBoardButtonHover() {
    // Clear all board button effects, not just the hovered one
    const allBoardButtons = document.querySelectorAll('.board-button');
    allBoardButtons.forEach(button => {
        button.classList.remove('drag-hover', 'drag-proximity');
    });
    
    hoveredBoardButton = null;
    clearHoverAnimations();
    
    // Also hide transfer message when clearing hover
    hideDragTransferMessage();
}

function checkBoardButtonDrop() {
    if (!hoveredBoardButton) {
        return { moved: false };
    }
    
    const targetBoardId = parseInt(hoveredBoardButton.dataset.boardId);
    const notesToMove = selectedNotes.length > 0 ? [...selectedNotes] : [activeNote];
    
    // If dropped on the active board, move notes up by 250px
    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => {
            if (note) {
                const currentTop = parseInt(note.style.top) || 0;
                note.style.top = `${currentTop - 250}px`;
            }
        });
        return { moved: false };
    }
    
    // Move the note(s) to the target board
    notesToMove.forEach(note => {
        if (note) {
            moveNoteToBoard(note, targetBoardId);
        }
    });
    
    // Clear selection after moving
    if (selectedNotes.length > 0) {
        clearSelection();
    }
    
    return { moved: true };
}

function moveNoteToBoard(note, targetBoardId) {
    // Store current position before moving
    const currentLeft = note.style.left;
    const currentTop = parsePosition(note.style.top);
    
    // If note is already hover-animating, complete the animation
    if (note.classList.contains('hover-animating')) {
        // Continue with the completion animation using existing suck variables
        note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
        note.classList.remove('hover-animating');
    } else {
        // Get board button position for full animation
        const targetButton = document.querySelector(`.board-button[data-board-id="${targetBoardId}"]`);
        if (!targetButton) return;
        
        const buttonRect = targetButton.getBoundingClientRect();
        const noteRect = note.getBoundingClientRect();
        const boardRect = note.closest('.board').getBoundingClientRect();
        
        // Calculate relative positions within the board (same as hover animation)
        const noteRelativeX = noteRect.left - boardRect.left;
        const noteRelativeY = noteRect.top - boardRect.top;
        const buttonRelativeX = buttonRect.left - boardRect.left + (buttonRect.width / 2);
        const buttonRelativeY = buttonRect.top - boardRect.top + (buttonRect.height / 2);
        
        const targetX = buttonRelativeX - noteRelativeX - (noteRect.width / 2);
        const targetY = buttonRelativeY - noteRelativeY - (noteRect.height / 2);
        
        // Set CSS variables for animation
        note.style.setProperty('--suckX', `${targetX}px`);
        note.style.setProperty('--suckY', `${targetY}px`);
        
        // Start the hover animation first, then complete
        note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
        note.classList.add('hover-animating');
    }
    
    // Wait for hover animation, then start completion
    setTimeout(() => {
        if (note.classList.contains('hover-animating')) {
            note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
            note.classList.remove('hover-animating');
        }
    }, 300);
    
    // After both animations complete, move to target board
    const animationDuration = 600; // Total time for both animations
    setTimeout(() => {
        // Re-enable text selection after transfer
        const textareas = note.querySelectorAll('textarea, [contenteditable]');
        textareas.forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('-webkit-user-select');
            textarea.style.removeProperty('-moz-user-select');
            textarea.style.removeProperty('-ms-user-select');
            textarea.style.removeProperty('pointer-events');
        });
        
        // Remove note from current board
        const currentBoard = note.closest('.board');
        if (currentBoard) {
            note.remove();
        }
        
        // Add note to target board
        const targetBoard = document.querySelector(`.board[data-board-id="${targetBoardId}"]`);
        if (targetBoard) {
            // Reset animation and position
            note.style.animation = '';
            note.style.removeProperty('--suckX');
            note.style.removeProperty('--suckY');
            
            // Keep horizontal position, move up by 250px
            note.style.left = currentLeft;
            const newTop = Math.max(60, currentTop - 250); // Start at 60px to avoid header
            note.style.top = `${newTop}px`;
            
            // Mark as repositioned since it was manually moved
            let noteId = note.dataset.noteId;
            if (!noteId) {
                noteId = generateNoteId(note);
                note.dataset.noteId = noteId;
            }
            repositionedNotes.add(noteId);
            note.dataset.repositioned = 'true';
            
            targetBoard.appendChild(note);
            
            // Fade in animation for the note in new position
            note.style.animation = 'paperPop 0.3s ease-out forwards';
            
            // Update board indicators
            updateBoardIndicators();
            
            // Clear board button hover effects after transfer
            clearBoardButtonHover();
            
            // Save both source and target boards after transfer
            saveActiveNotes(); // Save current board (source)
            const originalBoardId = currentBoardId;
            currentBoardId = targetBoardId;
            saveActiveNotes(); // Save target board
            currentBoardId = originalBoardId; // Restore original board
        }
    }, 600); // Match animation duration
}