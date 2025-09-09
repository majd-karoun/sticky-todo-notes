/**
 * SELECTION MANAGEMENT MODULE
 * Handles multi-note selection functionality including:
 * - Visual selection box creation and management
 * - Mouse-based selection area detection
 * - Multi-note drag and drop operations
 * - Selection state management and cleanup
 * - Integration with note transfer system
 */

// SELECTION BOX CREATION AND SETUP

/**
 * Creates the visual selection box element and adds it to the DOM
 * The selection box is initially hidden and positioned absolutely
 */
const createSelectionBox = () => {
    selectionBox = Object.assign(document.createElement('div'), { className: 'selection-box' });
    Object.assign(selectionBox.style, { display: 'none' });
    document.body.appendChild(selectionBox);
};

/**
 * Initializes selection event handlers for the board container
 * Sets up mouse events for selection box creation and management
 * Prevents default behavior on board areas to enable custom selection
 */
function initBoardSelectionHandlers() {
    const boardsContainer = $('.boards-container');
    // Prevent default selection behavior on board areas (but not on interactive elements)
    const preventDefaultHandler = e => {
        e.target.closest('.board') && !e.target.closest('.sticky-note, .note-input, .boards-navigation, .trash-bin, .board-style-button') && e.preventDefault();
    };
    
    document.addEventListener('mousedown', preventDefaultHandler);
    // Setup selection event handlers
    boardsContainer.addEventListener('mousedown', startSelection);
    
    // Register global selection handlers
    document.addEventListener('mousemove', updateSelection);
    document.addEventListener('mouseup', endSelection);
}

/**
 * Starts the selection process when mouse is pressed on board area
 * Ignores clicks on interactive elements and handles focus management
 * @param {Event} e - The mousedown event
 */
function startSelection(e) {
    // Ignore selection on interactive elements
    if (e.target.closest('.sticky-note, .note-input, .trash-bin, .boards-navigation, .board-style-button, .emoji-sticker')) return;
    e.preventDefault();
    
    // Blur textarea if it's focused to prevent interference
    const textarea = $('.note-input textarea');
    textarea && document.activeElement === textarea && textarea.blur();
    
    // Clear existing selection unless Shift is held (for additive selection)
    !e.shiftKey && clearSelection();

    // Initialize selection state and create selection box
    window.isSelecting = true;
    window.selectionStartX = e.clientX;
    window.selectionStartY = e.clientY;
    document.body.classList.add('selecting');
    if (window.AnimationUtils) {
        window.AnimationUtils.updateStyles(selectionBox, {
            left: `${window.selectionStartX}px`,
            top: `${window.selectionStartY}px`,
            width: '0',
            height: '0',
            display: 'block'
        });
    } else {
        selectionBox.style.cssText = `left:${window.selectionStartX}px; top:${window.selectionStartY}px; width:0; height:0; display:block;`;
    }
}

/**
 * Updates the selection box size and position during mouse drag
 * Calculates intersection with notes in real-time
 * @param {Event} e - The mousemove event
 * @param {Object} eventState - Global event state
 */
function updateSelection(e) {
    if (!window.isSelecting) return;
    e.preventDefault();
    
    const startX = window.selectionStartX;
    const startY = window.selectionStartY;
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Update selection box position and size using animation batcher
    AnimationUtils.updateStyles(selectionBox, {
      left: `${Math.min(startX, currentX)}px`,
      top: `${Math.min(startY, currentY)}px`,
      width: `${Math.abs(currentX - startX)}px`,
      height: `${Math.abs(currentY - startY)}px`
    }, 'high');
    
    checkNotesInSelection();
}

/**
 * Ends the selection process and hides the selection box
 * Maintains selected notes for further operations
 * @param {Event} e - The mouseup event
 * @param {Object} eventState - Global event state
 */
const endSelection = (e) => {
    if (!window.isSelecting) return;
    window.isSelecting = false;
    document.body.classList.remove('selecting');
    if (window.AnimationUtils) {
        window.AnimationUtils.updateStyles(selectionBox, { display: 'none' });
    } else {
        selectionBox.style.display = 'none';
    }
};

/**
 * Checks which notes intersect with the current selection box
 * Updates the selected notes array and visual selection state
 */
function checkNotesInSelection() {
    const selectionRect = selectionBox.getBoundingClientRect();
    const currentBoardElement = $(`.board[data-board-id="${currentBoardId}"]`);
    if (!currentBoardElement) return;

    /**
     * Checks if an element intersects with the selection box
     * @param {Element} element - The element to check
     * @param {Array} selectedArray - Array to manage selected elements
     * @param {string} className - CSS class to add/remove for visual feedback
     */
    const checkIntersection = (element, selectedArray, className) => {
        const rect = element.getBoundingClientRect();
        // Check for rectangle intersection (no overlap if completely separated)
        const intersects = !(rect.right < selectionRect.left || rect.left > selectionRect.right || rect.bottom < selectionRect.top || rect.top > selectionRect.bottom);
        const index = selectedArray.indexOf(element);
        
        // Add to selection if intersecting and not already selected
        intersects ? (index === -1 && [selectedArray.push(element), element.classList.add(className)]) : 
                    // Remove from selection if not intersecting (but only if not currently moving selection)
                    (!isMovingSelection && index !== -1 && [selectedArray.splice(index, 1), element.classList.remove(className)]);
    };

    // Check all notes on current board for intersection
    Array.from(currentBoardElement.querySelectorAll('.sticky-note')).forEach(note => checkIntersection(note, selectedNotes, 'selected'));
}

/**
 * Clears all selected notes and removes visual selection indicators
 */
const clearSelection = () => {
    selectedNotes.forEach(item => item.classList.remove('selected'));
    selectedNotes = [];
};

// MULTI-NOTE MOVEMENT HANDLING

/**
 * Initiates movement of multiple selected notes
 * Records initial positions for relative movement calculations
 * @param {Event} e - The mousedown event that started the move
 */
function handleSelectionMove(e) {
    window.isMovingSelection = true;
    window.selectionMoveStartX = e.clientX;
    window.selectionMoveStartY = e.clientY;
    document.body.classList.add('selecting');
    
    // Store initial positions of all selected notes for relative movement
    notesInitialPositions = selectedNotes.map(note => ({ 
        element: note, 
        x: parsePosition(note.style.left), 
        y: parsePosition(note.style.top), 
        type: 'note' 
    }));
    
    // Register movement handlers
    document.addEventListener('mousemove', moveSelectionHandler);
    document.addEventListener('mouseup', endSelectionMoveHandler);
}

/**
 * Handles the movement of selected notes during drag operation
 * Maintains relative positions and enforces boundary constraints
 * @param {Event} e - The mousemove event
 * @param {Object} eventState - Global event state
 */
function moveSelectionHandler(e) {
    if (!window.isMovingSelection) return;
    
    // Calculate movement delta from start position
    const [dx, dy] = [e.clientX - window.selectionMoveStartX, e.clientY - window.selectionMoveStartY];
    const [padding, minX, minY] = [5, -5, -5];
    const [maxX, maxY] = [window.innerWidth - padding, window.innerHeight - padding];

    /**
     * Moves a collection of items by the calculated delta
     * @param {Array} items - Array of items with element, x, y properties
     */
    const moveItems = items => items.forEach(item => {
        // Calculate new position with boundary constraints
        const [newX, newY] = [
            Math.min(Math.max(item.x + dx, minX), maxX - (item.element.offsetWidth / 4)),
            Math.min(Math.max(item.y + dy, minY), maxY - (item.element.offsetHeight / 4))
        ];
        AnimationUtils.updatePosition(item.element, newX, newY);
    });

    // Move all notes maintaining their relative positions
    moveItems(notesInitialPositions);
    
    // Handle board transfer UI when dragging multiple notes
    selectedNotes.length > 0 && [checkBoardButtonHover(e.clientX, e.clientY), selectedNotes.length > 1 && showDragTransferMessage()];
}

/**
 * Ends the multi-note movement operation
 * Handles board transfers, trash collisions, and cleanup
 * @param {Event} e - The mouseup event
 * @param {Object} eventState - Global event state
 */
function endSelectionMoveHandler(e) {
    if (!window.isMovingSelection) return;
    window.isMovingSelection = false;
    document.body.classList.remove('selecting');
    
    // Unregister movement handlers
    document.removeEventListener('mousemove', moveSelectionHandler);
    document.removeEventListener('mouseup', endSelectionMoveHandler);
    
    hideDragTransferMessage();
    
    // Check if notes were dropped on a different board
    const dropResult = checkBoardButtonDrop();
    if (!dropResult.moved) {
        // Notes stayed on current board - save positions and check for trash collisions
        saveActiveNotes();
        
        // Check each selected note for trash collision (iterate backwards for safe removal)
        for (let i = selectedNotes.length - 1; i >= 0; i--) {
            checkTrashCollision(selectedNotes[i]) && selectedNotes.splice(i, 1);
        }
    }
    
    clearBoardButtonHover();
}