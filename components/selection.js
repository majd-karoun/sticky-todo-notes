// Selection Box Management
const createSelectionBox = () => {
    selectionBox = Object.assign(document.createElement('div'), { className: 'selection-box' });
    Object.assign(selectionBox.style, { display: 'none' });
    document.body.appendChild(selectionBox);
};

function initBoardSelectionHandlers() {
    const boardsContainer = document.querySelector('.boards-container');
    document.addEventListener('mousedown', e => {
        e.target.closest('.board') && !e.target.closest('.sticky-note, .note-input, .boards-navigation, .trash-bin, .board-style-button') && e.preventDefault();
    });
    [['mousedown', startSelection], ['mousemove', updateSelection], ['mouseup', endSelection]].forEach(([event, handler]) => 
        (event === 'mousedown' ? boardsContainer : document).addEventListener(event, handler)
    );
}

function startSelection(e) {
    if (e.target.closest('.sticky-note, .note-input, .trash-bin, .boards-navigation, .board-style-button, .emoji-sticker')) return;
    e.preventDefault();
    const textarea = document.querySelector('.note-input textarea');
    textarea && document.activeElement === textarea && textarea.blur();
    !e.shiftKey && clearSelection();

    [isSelecting, selectionStartX, selectionStartY] = [true, e.clientX, e.clientY];
    [document.body.classList.add('selecting'), selectionBox.style.cssText = `left:${selectionStartX}px; top:${selectionStartY}px; width:0; height:0; display:block;`];
}

function updateSelection(e) {
    if (!isSelecting) return;
    e.preventDefault();
    const [width, height] = [Math.abs(e.clientX - selectionStartX), Math.abs(e.clientY - selectionStartY)];
    const [left, top] = [Math.min(e.clientX, selectionStartX), Math.min(e.clientY, selectionStartY)];
    [selectionBox.style.cssText = `left:${left}px; top:${top}px; width:${width}px; height:${height}px; display:block;`, checkNotesInSelection()];
}

const endSelection = () => {
    if (!isSelecting) return;
    isSelecting = false;
    document.body.classList.remove('selecting');
    selectionBox.style.display = 'none';
};

function checkNotesInSelection() {
    const selectionRect = selectionBox.getBoundingClientRect();
    const currentBoardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    if (!currentBoardElement) return;

    const checkIntersection = (element, selectedArray, className) => {
        const rect = element.getBoundingClientRect();
        const intersects = !(rect.right < selectionRect.left || rect.left > selectionRect.right || rect.bottom < selectionRect.top || rect.top > selectionRect.bottom);
        const index = selectedArray.indexOf(element);
        intersects ? (index === -1 && [selectedArray.push(element), element.classList.add(className)]) : 
                    (!isMovingSelection && index !== -1 && [selectedArray.splice(index, 1), element.classList.remove(className)]);
    };

    currentBoardElement.querySelectorAll('.sticky-note').forEach(note => checkIntersection(note, selectedNotes, 'selected'));
}

const clearSelection = () => {
    selectedNotes.forEach(item => item.classList.remove('selected'));
    selectedNotes = [];
};

function handleSelectionMove(e) {
    [isMovingSelection, selectionMoveStartX, selectionMoveStartY] = [true, e.clientX, e.clientY];
    document.body.classList.add('selecting');
    notesInitialPositions = selectedNotes.map(note => ({ element: note, x: parsePosition(note.style.left), y: parsePosition(note.style.top), type: 'note' }));
    ['mousemove', 'mouseup'].forEach(event => document.addEventListener(event, event === 'mousemove' ? moveSelectionHandler : endSelectionMoveHandler));
}

function moveSelectionHandler(e) {
    if (!isMovingSelection) return;
    const [dx, dy] = [e.clientX - selectionMoveStartX, e.clientY - selectionMoveStartY];
    const [padding, minX, minY] = [5, -5, -5];
    const [maxX, maxY] = [window.innerWidth - padding, window.innerHeight - padding];

    const moveItems = items => items.forEach(item => {
        const [newX, newY] = [
            Math.min(Math.max(item.x + dx, minX), maxX - (item.element.offsetWidth / 4)),
            Math.min(Math.max(item.y + dy, minY), maxY - (item.element.offsetHeight / 4))
        ];
        Object.assign(item.element.style, { left: `${newX}px`, top: `${newY}px` });
    });

    moveItems(notesInitialPositions);
    
    selectedNotes.length > 0 && [checkBoardButtonHover(e.clientX, e.clientY), selectedNotes.length > 1 && showDragTransferMessage()];
}

function endSelectionMoveHandler() {
    if (!isMovingSelection) return;
    isMovingSelection = false;
    document.body.classList.remove('selecting');
    ['mousemove', 'mouseup'].forEach(event => document.removeEventListener(event, event === 'mousemove' ? moveSelectionHandler : endSelectionMoveHandler));
    
    hideDragTransferMessage();
    
    const dropResult = checkBoardButtonDrop();
    if (!dropResult.moved) {
        saveActiveNotes();
        

        for (let i = selectedNotes.length - 1; i >= 0; i--) {
            checkTrashCollision(selectedNotes[i]) && selectedNotes.splice(i, 1);
        }
    }
    
    clearBoardButtonHover();
}