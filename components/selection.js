// Selection Box Management
function createSelectionBox() {
    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.display = 'none';
    document.body.appendChild(selectionBox);
}

function initBoardSelectionHandlers() {
    const boardsContainer = document.querySelector('.boards-container');
    // Prevent text selection on board click (not on interactive elements)
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.board') &&
            !e.target.closest('.sticky-note, .note-input, .boards-navigation, .trash-bin, .board-style-button')) {
            e.preventDefault();
        }
    });
    boardsContainer.addEventListener('mousedown', startSelection);
    document.addEventListener('mousemove', updateSelection);
    document.addEventListener('mouseup', endSelection);
}

function startSelection(e) {
    if (e.target.closest('.sticky-note, .note-input, .trash-bin, .boards-navigation, .board-style-button')) return;
    e.preventDefault();
    const textarea = document.querySelector('.note-input textarea');
    if (textarea && document.activeElement === textarea) textarea.blur();
    if (!e.shiftKey) clearSelection();

    isSelecting = true;
    document.body.classList.add('selecting');
    selectionStartX = e.clientX;
    selectionStartY = e.clientY;
    selectionBox.style.cssText = `left:${selectionStartX}px; top:${selectionStartY}px; width:0; height:0; display:block;`;
}

function updateSelection(e) {
    if (!isSelecting) return;
    e.preventDefault();
    const width = Math.abs(e.clientX - selectionStartX);
    const height = Math.abs(e.clientY - selectionStartY);
    const left = Math.min(e.clientX, selectionStartX);
    const top = Math.min(e.clientY, selectionStartY);
    selectionBox.style.cssText = `left:${left}px; top:${top}px; width:${width}px; height:${height}px; display:block;`;
    checkNotesInSelection();
}

function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;
    document.body.classList.remove('selecting');
    selectionBox.style.display = 'none';
}

function checkNotesInSelection() {
    const selectionRect = selectionBox.getBoundingClientRect();
    const currentBoardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    if (!currentBoardElement) return; // Ensure board exists

    Array.from(currentBoardElement.querySelectorAll('.sticky-note')).forEach(note => {
        const noteRect = note.getBoundingClientRect();
        const intersects = !(noteRect.right < selectionRect.left || noteRect.left > selectionRect.right ||
                             noteRect.bottom < selectionRect.top || noteRect.top > selectionRect.bottom);
        const index = selectedNotes.indexOf(note);
        if (intersects) {
            if (index === -1) { selectedNotes.push(note); note.classList.add('selected'); }
        } else if (!isMovingSelection && index !== -1) { // Only remove if not actively moving the selection
            selectedNotes.splice(index, 1); note.classList.remove('selected');
        }
    });
}

function clearSelection() {
    selectedNotes.forEach(note => note.classList.remove('selected'));
    selectedNotes = [];
}

function handleSelectionMove(e) {
    isMovingSelection = true;
    document.body.classList.add('selecting'); // May already be added, but ensure
    selectionMoveStartX = e.clientX;
    selectionMoveStartY = e.clientY;
    notesInitialPositions = selectedNotes.map(note => ({
        note, x: parsePosition(note.style.left), y: parsePosition(note.style.top)
    }));
    document.addEventListener('mousemove', moveSelectionHandler);
    document.addEventListener('mouseup', endSelectionMoveHandler);
}

function moveSelectionHandler(e) {
    if (!isMovingSelection) return;
    const dx = e.clientX - selectionMoveStartX;
    const dy = e.clientY - selectionMoveStartY;
    const padding = 5, minX = -padding, minY = -padding;
    const maxX = window.innerWidth - padding, maxY = window.innerHeight - padding;

    notesInitialPositions.forEach(item => {
        let newX = item.x + dx;
        let newY = item.y + dy;
        // Constrain to allow 3/4 of note off-screen, as per single note drag
        newX = Math.min(Math.max(newX, minX), maxX - (item.note.offsetWidth / 4));
        newY = Math.min(Math.max(newY, minY), maxY - (item.note.offsetHeight / 4));
        item.note.style.left = `${newX}px`;
        item.note.style.top = `${newY}px`;
    });
}

function endSelectionMoveHandler() {
    if (!isMovingSelection) return;
    isMovingSelection = false;
    document.body.classList.remove('selecting');
    document.removeEventListener('mousemove', moveSelectionHandler);
    document.removeEventListener('mouseup', endSelectionMoveHandler);
    saveActiveNotes();

    // Iterate backwards when splicing to avoid index issues
    for (let i = selectedNotes.length - 1; i >= 0; i--) {
        if (checkTrashCollision(selectedNotes[i])) {
            selectedNotes.splice(i, 1); // Remove from selection if trashed
        }
    }
    // If all selected notes were trashed, selection should be empty.
    // If some remain, they stay selected.
}