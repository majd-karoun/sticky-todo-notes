// Board button drag-and-drop functionality
function checkBoardButtonHover(clientX, clientY) {
    if (hoverDetectionDisabled) return;
    const statusBar = document.querySelector('.status-bar');
    if (!statusBar) return;
    
    const statusBarRect = statusBar.getBoundingClientRect();
    const [distanceX, distanceY] = [Math.max(0, Math.max(statusBarRect.left - clientX, clientX - statusBarRect.right)), Math.max(0, Math.max(statusBarRect.top - clientY, clientY - statusBarRect.bottom))];
    const [distance, enterThreshold, exitThreshold, wasNearMenu] = [Math.sqrt(distanceX * distanceX + distanceY * distanceY), 120, 80, hoveredBoardButton !== null];
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
            boardButtons.forEach(button => button.classList.add('drag-active', 'drag-proximity'));
            if (hoveredBoardButton) hoveredBoardButton.classList.add('drag-hover');
            startHoverAnimation();
        } else {
            document.querySelectorAll('.board-button').forEach(button => {
                button.classList.remove('drag-hover', 'drag-proximity');
                setTimeout(() => button.classList.remove('drag-active'), 200);
            });
            hoveredBoardButton = null;
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
    const [buttonRect, notesToAnimate] = [hoveredBoardButton.getBoundingClientRect(), selectedNotes.length > 0 ? selectedNotes : (activeNote ? [activeNote] : [])];

    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
                [textarea.style.userSelect, textarea.style.pointerEvents] = ['none', 'none'];
            });

            const [noteRect, boardRect] = [note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect()];
            const [targetX, targetY] = [
                (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2),
                (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2)
            ];

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
                [note.style.animation] = ['none'];
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
    [hoveredBoardButton] = [null];
    clearHoverAnimations();
    hideDragTransferMessage();
}

function checkBoardButtonDrop() {
    if (!hoveredBoardButton) return { moved: false };

    const [targetBoardId, notesToMove] = [parseInt(hoveredBoardButton.dataset.boardId), selectedNotes.length > 0 ? [...selectedNotes] : [activeNote]];

    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => {
            if (note) note.style.top = `${parseInt(note.style.top || 0) - 250}px`;
        });
        return { moved: false };
    }

    let relativePositions = new Map();
    if (notesToMove.length > 1 && typeof notesInitialPositions !== 'undefined' && notesInitialPositions.length > 0) {
        let [minLeft, minTop] = [Infinity, Infinity];
        notesInitialPositions.forEach(notePos => {
            if (notePos && notesToMove.includes(notePos.element)) {
                [minLeft, minTop] = [Math.min(minLeft, notePos.x), Math.min(minTop, notePos.y)];
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

        const [buttonRect, noteRect, boardRect] = [targetButton.getBoundingClientRect(), note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect()];
        const [targetX, targetY] = [
            (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2),
            (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2)
        ];

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

        note.remove();

        const targetBoard = document.querySelector(`.board[data-board-id="${targetBoardId}"]`);
        if (targetBoard) {
            note.style.animation = '';
            note.style.removeProperty('--suckX');
            note.style.removeProperty('--suckY');

            if (relativePosition) {
                let originalPosition = notesInitialPositions?.find(pos => pos.element === note);
                if (originalPosition) {
                    [note.style.left, note.style.top] = [`${originalPosition.x}px`, `${Math.max(60, originalPosition.y)}px`];
                } else {
                    const [baseLeft, baseTop] = [100, 80];
                    [note.style.left, note.style.top] = [`${baseLeft + relativePosition.offsetX}px`, `${Math.max(60, baseTop + relativePosition.offsetY)}px`];
                }
            } else {
                const [originalX, originalY] = [parseFloat(note.dataset.originalX), parseFloat(note.dataset.originalY)];
                if (!isNaN(originalX) && !isNaN(originalY)) {
                    [note.style.left, note.style.top] = [`${originalX}px`, `${Math.max(60, originalY)}px`];
                } else {
                    [note.style.left, note.style.top] = [currentLeft, '80px'];
                }
            }

            const noteId = note.dataset.noteId || generateNoteId();
            [note.dataset.noteId, note.dataset.repositioned] = [noteId, 'true'];
            repositionedNotes.add(noteId);

            targetBoard.appendChild(note);
            note.style.animation = 'paperPop 0.3s ease-out forwards';

            updateBoardIndicators();
            clearBoardButtonHover();

            hoverDetectionDisabled = true;
            setTimeout(() => hoverDetectionDisabled = false, 500);

            const originalBoardId = currentBoardId;
            [currentBoardId] = [targetBoardId];
            saveActiveNotes();
            [currentBoardId] = [originalBoardId];
            saveActiveNotes();
        }
    }, 600);
}
