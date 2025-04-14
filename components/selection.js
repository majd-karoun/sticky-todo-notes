// Create selection box element
function createSelectionBox() {
    selectionBox = document.createElement('div'); // selectionBox is in utils.js
    selectionBox.className = 'selection-box';
    selectionBox.style.display = 'none';
    document.body.appendChild(selectionBox);
}

// Handle selection box and multi-note selection
function initBoardSelectionHandlers() {
    const boardsContainer = document.querySelector('.boards-container');

    // Add pointer-events: none to all UI elements' text to prevent text selection
    document.addEventListener('mousedown', function(e) {
        // If we're starting a selection, prevent text selection
        if (e.target.closest('.board') &&
            !e.target.closest('.sticky-note') &&
            !e.target.closest('.note-input') &&
            !e.target.closest('.boards-navigation') &&
            !e.target.closest('.trash-bin') &&
            !e.target.closest('.board-style-button')) {
            e.preventDefault(); // Prevent text selection
        }
    });

    boardsContainer.addEventListener('mousedown', startSelection);
    document.addEventListener('mousemove', updateSelection);
    document.addEventListener('mouseup', endSelection);
}

function startSelection(e) {
    // Only start selection if clicking directly on the board, not on a note or control
    if (e.target.closest('.sticky-note') ||
        e.target.closest('.note-input') ||
        e.target.closest('.trash-bin') ||
        e.target.closest('.boards-navigation') ||
        e.target.closest('.board-style-button')) {
        return;
    }

    // Prevent default to avoid text selection
    e.preventDefault();

    // If textarea is focused, blur it first
    const textarea = document.querySelector('.note-input textarea');
    if (textarea && document.activeElement === textarea) {
        textarea.blur();
    }

    // Clear selection if not holding shift
    if (!e.shiftKey) {
        clearSelection();
    }

    isSelecting = true; // isSelecting is in utils.js
    document.body.classList.add('selecting');
    selectionStartX = e.clientX; // selectionStartX is in utils.js
    selectionStartY = e.clientY; // selectionStartY is in utils.js

    // Position and show the selection box
    selectionBox.style.left = `${selectionStartX}px`;
    selectionBox.style.top = `${selectionStartY}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
}

function updateSelection(e) {
    if (!isSelecting) return; // isSelecting is in utils.js

    // Prevent default to avoid text selection
    e.preventDefault();

    // Calculate selection box dimensions
    const width = Math.abs(e.clientX - selectionStartX); // selectionStartX is in utils.js
    const height = Math.abs(e.clientY - selectionStartY); // selectionStartY is in utils.js

    // Calculate top-left corner of selection box
    const left = e.clientX < selectionStartX ? e.clientX : selectionStartX;
    const top = e.clientY < selectionStartY ? e.clientY : selectionStartY;

    // Update selection box position and size
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    // Find notes that intersect with the selection box
    checkNotesInSelection();
}

function endSelection() {
    if (!isSelecting) return; // isSelecting is in utils.js

    isSelecting = false;
    document.body.classList.remove('selecting');
    selectionBox.style.display = 'none';
}

function checkNotesInSelection() {
    // Get the bounds of the selection box
    const selectionRect = selectionBox.getBoundingClientRect();

    // Get all notes on the current board
    const currentBoardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`); // currentBoardId is in utils.js
    const notes = Array.from(currentBoardElement.querySelectorAll('.sticky-note'));

    // Check each note to see if it intersects with the selection box
    notes.forEach(note => {
        const noteRect = note.getBoundingClientRect();

        // Check for intersection
        const intersects = !(
            noteRect.right < selectionRect.left ||
            noteRect.left > selectionRect.right ||
            noteRect.bottom < selectionRect.top ||
            noteRect.top > selectionRect.bottom
        );

        // Add or remove from selection based on intersection
        if (intersects) {
            if (!selectedNotes.includes(note)) { // selectedNotes is in utils.js
                selectedNotes.push(note);
                note.classList.add('selected');
            }
        } else if (!isMovingSelection) { // isMovingSelection is in utils.js
            // Only remove if not moving selection
            const index = selectedNotes.indexOf(note);
            if (index !== -1) {
                selectedNotes.splice(index, 1);
                note.classList.remove('selected');
            }
        }
    });
}

function clearSelection() {
    selectedNotes.forEach(note => { // selectedNotes is in utils.js
        note.classList.remove('selected');
    });
    selectedNotes = [];
}

function handleSelectionMove(e) {
    // Start moving all selected notes
    isMovingSelection = true; // isMovingSelection is in utils.js
    document.body.classList.add('selecting');
    selectionMoveStartX = e.clientX; // selectionMoveStartX is in utils.js
    selectionMoveStartY = e.clientY; // selectionMoveStartY is in utils.js

    // Store initial positions of all selected notes
    notesInitialPositions = selectedNotes.map(note => ({ // notesInitialPositions, selectedNotes are in utils.js
        note: note,
        x: parsePosition(note.style.left), // parsePosition is in utils.js
        y: parsePosition(note.style.top)
    }));

    // Set up move and end handlers
    document.addEventListener('mousemove', moveSelectionHandler);
    document.addEventListener('mouseup', endSelectionMoveHandler);
}

function moveSelectionHandler(e) {
    if (!isMovingSelection) return; // isMovingSelection is in utils.js

    const dx = e.clientX - selectionMoveStartX; // selectionMoveStartX is in utils.js
    const dy = e.clientY - selectionMoveStartY; // selectionMoveStartY is in utils.js

    // Calculate board boundaries for selected notes
    const padding = 5;
    const minX = -padding;
    const minY = -padding;
    const maxX = window.innerWidth - padding;
    const maxY = window.innerHeight - padding;

    // Move each selected note by the same amount
    notesInitialPositions.forEach(item => { // notesInitialPositions is in utils.js
        let newX = item.x + dx;
        let newY = item.y + dy;

        // Keep notes within bounds
        newX = Math.min(Math.max(newX, minX), maxX - (item.note.offsetWidth / 4));
        newY = Math.min(Math.max(newY, minY), maxY - (item.note.offsetHeight / 4));

        item.note.style.left = `${newX}px`;
        item.note.style.top = `${newY}px`;
    });
}

function endSelectionMoveHandler() {
    if (!isMovingSelection) return; // isMovingSelection is in utils.js

    isMovingSelection = false;
    document.body.classList.remove('selecting');
    document.removeEventListener('mousemove', moveSelectionHandler);
    document.removeEventListener('mouseup', endSelectionMoveHandler);

    // Save the changes to localStorage
    saveActiveNotes(); // saveActiveNotes is in utils.js

    // Update the positions and check for trash collision
    selectedNotes.forEach(note => { // selectedNotes is in utils.js
        if (checkTrashCollision(note)) { // checkTrashCollision is in trash.js
            // If a note was deleted, we need to update the selectedNotes array
            const index = selectedNotes.indexOf(note);
            if (index !== -1) {
                selectedNotes.splice(index, 1);
            }
        }
    });
}
