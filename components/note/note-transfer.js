/**
 * NOTE TRANSFER MODULE
 * Handles drag-and-drop functionality for transferring notes between boards
 * Optimized for minimal code duplication and clear separation of concerns
 */

// Utility functions for common operations
const getDistance = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
const getButtonCenter = rect => [rect.left + rect.width / 2, rect.top + rect.height / 2];
const findClosestButton = (clientX, clientY) => {
    let closest = { button: null, distance: Infinity };
    $$('.board-button:not(.disabled)', true).forEach(button => {
        const [centerX, centerY] = getButtonCenter(button.getBoundingClientRect());
        const distance = getDistance(clientX, clientY, centerX, centerY);
        if (distance < closest.distance) closest = { button, distance };
    });
    return closest.button;
};

const toggleBoardButtons = (isEntering, closestButton = null) => {
    const buttons = $$('.board-button', true);
    if (isEntering) {
        buttons.forEach(btn => btn.classList.add('drag-active', 'drag-proximity'));
        if (closestButton) closestButton.classList.add('drag-hover');
        startHoverAnimation();
    } else {
        buttons.forEach(btn => {
            btn.classList.remove('drag-hover', 'drag-proximity');
            setTimeout(() => btn.classList.remove('drag-active'), 200);
        });
        clearHoverAnimations();
    }
};

function checkBoardButtonHover(clientX, clientY) {
    if (hoverDetectionDisabled) return;
    const statusBar = $('.status-bar');
    if (!statusBar) return;
    
    const rect = statusBar.getBoundingClientRect();
    const distanceX = Math.max(0, rect.left - clientX, clientX - rect.right);
    const distanceY = Math.max(0, rect.top - clientY, clientY - rect.bottom);
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
    
    const wasNear = hoveredBoardButton !== null;
    const isNear = wasNear ? distance <= 120 : distance <= 80; // Hysteresis
    
    if (isNear !== wasNear) {
        hoveredBoardButton = isNear ? findClosestButton(clientX, clientY) : null;
        toggleBoardButtons(isNear, hoveredBoardButton);
    } else if (isNear) {
        const closest = findClosestButton(clientX, clientY);
        if (closest !== hoveredBoardButton) {
            hoveredBoardButton?.classList.remove('drag-hover');
            hoveredBoardButton = closest;
            if (closest) {
                closest.classList.add('drag-hover');
                hideDragTransferMessage();
                $('.shortcut-hint')?.classList.add('hidden-during-drag');
            } else {
                showDragTransferMessage();
                if (!dragTransferMessageVisible) $('.shortcut-hint')?.classList.remove('hidden-during-drag');
            }
        }
    }
}

// Animation utility functions
const applyStyles = (element, styles) => {
    if (window.AnimationUtils) {
        window.AnimationUtils.updateStyles(element, styles);
    } else {
        Object.entries(styles).forEach(([prop, value]) => {
            if (prop.startsWith('--')) {
                element.style.setProperty(prop, value);
            } else if (value === '') {
                element.style.removeProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
            } else {
                element.style[prop] = value;
            }
        });
    }
};

const toggleTextInteraction = (note, disabled) => {
    const styles = disabled ? { userSelect: 'none', pointerEvents: 'none' } : { userSelect: '', pointerEvents: '' };
    note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => applyStyles(textarea, styles));
};

const calculateSuckPosition = (buttonRect, noteRect, boardRect) => [
    (buttonRect.left - boardRect.left + buttonRect.width / 2) - (noteRect.left - boardRect.left) - noteRect.width / 2,
    (buttonRect.top - boardRect.top + buttonRect.height / 2) - (noteRect.top - boardRect.top) - noteRect.height / 2
];

function startHoverAnimation() {
    if (!hoveredBoardButton) return;
    const currentActiveNote = window.activeNote || activeNote;
    const notesToAnimate = selectedNotes.length > 0 ? selectedNotes : (currentActiveNote ? [currentActiveNote] : []);
    const buttonRect = hoveredBoardButton.getBoundingClientRect();

    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            toggleTextInteraction(note, true);
            const [targetX, targetY] = calculateSuckPosition(buttonRect, note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect());
            applyStyles(note, {
                '--suckX': `${targetX}px`,
                '--suckY': `${targetY}px`,
                animation: 'noteSuckHover 0.3s ease-out forwards'
            });
            note.classList.add('hover-animating');
        }
    });
}

function clearHoverAnimations() {
    $$('.hover-animating', true).forEach(note => {
        toggleTextInteraction(note, false);
        applyStyles(note, { animation: 'noteSuckReverse 0.3s ease-out forwards' });
        note.classList.remove('hover-animating');
        note.classList.add('reverse-animating');
        
        setTimeout(() => {
            if (note.classList.contains('reverse-animating')) {
                applyStyles(note, { animation: 'none', '--suckX': '', '--suckY': '' });
                note.classList.remove('reverse-animating');
            }
        }, 300);
    });
}

// Drag transfer messaging
const toggleDragTransferMessage = (show) => {
    if (show && boardCount > 1 && !dragTransferMessageVisible && !hoveredBoardButton) {
        document.getElementById('dragTransferMessage')?.classList.add('visible');
        dragTransferMessageVisible = true;
        $('.shortcut-hint')?.classList.add('hidden-during-drag');
    } else if (!show && dragTransferMessageVisible) {
        document.getElementById('dragTransferMessage')?.classList.remove('visible');
        dragTransferMessageVisible = false;
        $('.shortcut-hint')?.classList.remove('hidden-during-drag');
    }
};

const showDragTransferMessage = () => toggleDragTransferMessage(true);
const hideDragTransferMessage = () => toggleDragTransferMessage(false);

function clearBoardButtonHover() {
    $$('.board-button', true).forEach(button => button.classList.remove('drag-hover', 'drag-proximity'));
    hoveredBoardButton = null;
    clearHoverAnimations();
    hideDragTransferMessage();
}

/**
 * DROP HANDLING
 */

const returnNoteToOriginalPosition = (note) => {
    const originalPos = notesInitialPositions?.find(pos => pos.element === note);
    const targetX = originalPos ? originalPos.x : parseFloat(note.style.left) || 100;
    const targetY = originalPos ? Math.max(60, originalPos.y) : parseInt(note.style.top || 0) - 250;
    
    if (note.classList.contains('hover-animating')) {
        note.classList.remove('hover-animating');
        applyStyles(note, { '--suckX': '', '--suckY': '', animation: 'none' });
    }
    
    note.style.transition = 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out';
    note.style.left = `${targetX}px`;
    note.style.top = `${targetY}px`;
    note.style.transform = 'scale(1)';
    
    setTimeout(() => {
        note.style.transition = '';
        note.style.transform = '';
    }, 200);
};

const getRelativePositions = (notesToMove) => {
    const positions = new Map();
    if (notesToMove.length > 1 && notesInitialPositions?.length > 0) {
        notesInitialPositions.forEach(notePos => {
            if (notePos && notesToMove.includes(notePos.element)) {
                positions.set(notePos.element, { originalX: notePos.x, originalY: notePos.y });
            }
        });
    }
    return positions;
};

function checkBoardButtonDrop() {
    if (!hoveredBoardButton) return { moved: false };

    const currentActiveNote = window.activeNote || activeNote;
    const targetBoardId = parseInt(hoveredBoardButton.dataset.boardId);
    const notesToMove = selectedNotes.length > 0 ? [...selectedNotes] : [currentActiveNote];

    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => note && returnNoteToOriginalPosition(note));
        clearBoardButtonHover();
        toggleBoardButtons(false);
        return { moved: false };
    }

    const relativePositions = getRelativePositions(notesToMove);
    notesToMove.forEach(note => {
        if (note) moveNoteToBoard(note, targetBoardId, relativePositions.get(note) || null);
    });

    if (selectedNotes.length > 0) clearSelection();
    return { moved: true };
}

/**
 * CORE TRANSFER FUNCTION
 */

/**
 * Moves a note from current board to target board with smooth animations
 * Handles position preservation and multi-stage animation sequence
 * @param {Element} note - The note element to move
 * @param {number} targetBoardId - ID of the destination board
 * @param {Object|null} relativePosition - Position data for multi-note transfers
 */
function moveNoteToBoard(note, targetBoardId, relativePosition = null) {
    const currentLeft = note.style.left;

    // Handle notes already in hover animation state
    if (note.classList.contains('hover-animating')) {
        if (window.AnimationUtils) {
            window.AnimationUtils.updateStyles(note, {
                animation: 'noteSuckComplete 0.3s ease-in forwards'
            });
        } else {
            note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
        }
        note.classList.remove('hover-animating');
    } else {
        // Start animation for notes not already animating
        const targetButton = $(`.board-button[data-board-id="${targetBoardId}"]`);
        if (!targetButton) return;

        const [buttonRect, noteRect, boardRect] = [targetButton.getBoundingClientRect(), note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect()];
        const [targetX, targetY] = [
            (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2),
            (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2)
        ];

        if (window.AnimationUtils) {
            window.AnimationUtils.updateStyles(note, {
                '--suckX': `${targetX}px`,
                '--suckY': `${targetY}px`,
                animation: 'noteSuckHover 0.3s ease-out forwards'
            });
        } else {
            note.style.setProperty('--suckX', `${targetX}px`);
            note.style.setProperty('--suckY', `${targetY}px`);
            note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
        }
        note.classList.add('hover-animating');
    }

    // Complete the suction animation
    setTimeout(() => {
        if (note.classList.contains('hover-animating')) {
            if (window.AnimationUtils) {
                window.AnimationUtils.updateStyles(note, {
                    animation: 'noteSuckComplete 0.3s ease-in forwards'
                });
            } else {
                note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
            }
            note.classList.remove('hover-animating');
        }
    }, 300);

    // Final transfer phase - move note to target board
    setTimeout(() => {
        // Re-enable text interaction
        note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
            if (window.AnimationUtils) {
                window.AnimationUtils.updateStyles(textarea, {
                    userSelect: '',
                    pointerEvents: ''
                });
            } else {
                textarea.style.removeProperty('user-select');
                textarea.style.removeProperty('pointer-events');
            }
        });

        // Remove from current board
        note.remove();

        // Add to target board
        const targetBoard = $(`.board[data-board-id="${targetBoardId}"]`);
        if (targetBoard) {
            // Clean up animation properties
            if (window.AnimationUtils) {
                window.AnimationUtils.updateStyles(note, {
                    animation: '',
                    '--suckX': '',
                    '--suckY': ''
                });
            } else {
                note.style.animation = '';
                note.style.removeProperty('--suckX');
                note.style.removeProperty('--suckY');
            }

            // Set position on target board
            if (relativePosition) {
                // Multi-note transfer - use the actual original positions
                if (relativePosition.originalX !== undefined && relativePosition.originalY !== undefined) {
                    if (window.AnimationUtils) {
                        window.AnimationUtils.updatePosition(note, relativePosition.originalX, Math.max(60, relativePosition.originalY));
                    } else {
                        [note.style.left, note.style.top] = [`${relativePosition.originalX}px`, `${Math.max(60, relativePosition.originalY)}px`];
                    }
                } else {
                    // Fallback for legacy offset-based positioning
                    const [baseLeft, baseTop] = [100, 80];
                    const newX = baseLeft + (relativePosition.offsetX || 0);
                    const newY = Math.max(60, baseTop + (relativePosition.offsetY || 0));
                    if (window.AnimationUtils) {
                        window.AnimationUtils.updatePosition(note, newX, newY);
                    } else {
                        [note.style.left, note.style.top] = [`${newX}px`, `${newY}px`];
                    }
                }
            } else {
                // Single note transfer - use notesInitialPositions if available, otherwise use current position
                const initialPos = notesInitialPositions?.find(pos => pos.element === note);
                if (initialPos) {
                    // Use the same reliable position tracking as multi-note transfers
                    if (window.AnimationUtils) {
                        window.AnimationUtils.updatePosition(note, initialPos.x, Math.max(60, initialPos.y));
                    } else {
                        [note.style.left, note.style.top] = [`${initialPos.x}px`, `${Math.max(60, initialPos.y)}px`];
                    }
                } else {
                    // Fallback to current position if no initial position is tracked
                    const currentX = parseFloat(note.style.left) || 100;
                    const currentY = parseFloat(note.style.top) || 80;
                    if (window.AnimationUtils) {
                        window.AnimationUtils.updatePosition(note, currentX, Math.max(60, currentY));
                    } else {
                        [note.style.left, note.style.top] = [`${currentX}px`, `${Math.max(60, currentY)}px`];
                    }
                }
            }

            // Update note metadata and tracking
            const noteId = note.dataset.noteId || generateNoteId();
            [note.dataset.noteId, note.dataset.repositioned, note.dataset.transferred] = [noteId, 'true', 'true'];
            repositionedNotes.add(noteId);

            // Add to target board with pop animation
            targetBoard.appendChild(note);
            if (window.AnimationUtils) {
                window.AnimationUtils.updateStyles(note, {
                    animation: 'paperPop 0.3s ease-out forwards'
                });
            } else {
                note.style.animation = 'paperPop 0.3s ease-out forwards';
            }

            // Update UI and save state
            updateBoardIndicators();
            clearBoardButtonHover();

            // Temporarily disable hover detection to prevent interference
            hoverDetectionDisabled = true;
            setTimeout(() => hoverDetectionDisabled = false, 500);

            // Save notes on both boards AFTER position is set
            setTimeout(() => {
                const originalBoardId = currentBoardId;
                [currentBoardId] = [targetBoardId];
                window.DebouncedStorage.saveHigh(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
                [currentBoardId] = [originalBoardId];
                window.DebouncedStorage.saveHigh(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
            }, 100);
        }
    }, 600);
}
