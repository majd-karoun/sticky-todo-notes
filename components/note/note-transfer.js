/**
 * NOTE TRANSFER MODULE
 * Handles drag-and-drop functionality for transferring notes between boards
 * Features:
 * - Board button hover detection with proximity thresholds
 * - Visual feedback during drag operations
 * - Smooth animations for note transfers
 * - Multi-note selection support
 * - Position preservation during transfers
 */

/**
 * Checks if the mouse is hovering over board buttons during drag operations
 * Uses proximity detection with hysteresis to prevent flickering
 * @param {number} clientX - Mouse X coordinate
 * @param {number} clientY - Mouse Y coordinate
 */
function checkBoardButtonHover(clientX, clientY) {
    if (hoverDetectionDisabled) return;
    const statusBar = document.querySelector('.status-bar');
    if (!statusBar) return;
    
    // Calculate distance from mouse to status bar (board buttons area)
    const statusBarRect = statusBar.getBoundingClientRect();
    const [distanceX, distanceY] = [Math.max(0, Math.max(statusBarRect.left - clientX, clientX - statusBarRect.right)), Math.max(0, Math.max(statusBarRect.top - clientY, clientY - statusBarRect.bottom))];
    const [distance, enterThreshold, exitThreshold, wasNearMenu] = [Math.sqrt(distanceX * distanceX + distanceY * distanceY), 120, 80, hoveredBoardButton !== null];
    
    // Use hysteresis to prevent flickering between near/far states
    const isNearMenu = wasNearMenu ? (distance <= enterThreshold) : (distance <= exitThreshold);

    /**
     * Finds the board button closest to the current mouse position
     * @returns {Element|null} The closest board button or null
     */
    const findClosestButton = () => {
        let [closestButton, closestDistance] = [null, Infinity];
        document.querySelectorAll('.board-button:not(.disabled)').forEach(button => {
            const rect = button.getBoundingClientRect();
            const buttonDistance = Math.sqrt(Math.pow(clientX - (rect.left + rect.width / 2), 2) + Math.pow(clientY - (rect.top + rect.height / 2), 2));
            if (buttonDistance < closestDistance) [closestButton, closestDistance] = [button, buttonDistance];
        });
        return closestButton;
    };

    // Handle proximity state changes
    if (isNearMenu !== wasNearMenu) {
        if (isNearMenu) {
            // Entering proximity - activate all buttons and start hover effects
            const boardButtons = document.querySelectorAll('.board-button:not(.disabled)');
            hoveredBoardButton = findClosestButton();
            boardButtons.forEach(button => button.classList.add('drag-active', 'drag-proximity'));
            if (hoveredBoardButton) hoveredBoardButton.classList.add('drag-hover');
            startHoverAnimation();
        } else {
            // Leaving proximity - deactivate buttons and clear animations
            document.querySelectorAll('.board-button').forEach(button => {
                button.classList.remove('drag-hover', 'drag-proximity');
                setTimeout(() => button.classList.remove('drag-active'), 200);
            });
            hoveredBoardButton = null;
            clearHoverAnimations();
        }
    } else if (isNearMenu && hoveredBoardButton) {
        // Within proximity - check if closest button changed
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

/**
 * HOVER ANIMATION SYSTEM
 */

/**
 * Starts the "magnetic" hover animation when notes are near a board button
 * Creates a visual effect where notes are pulled toward the target board button
 */
function startHoverAnimation() {
    if (!hoveredBoardButton) return;
    const [buttonRect, notesToAnimate] = [hoveredBoardButton.getBoundingClientRect(), selectedNotes.length > 0 ? selectedNotes : (activeNote ? [activeNote] : [])];

    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            // Disable text selection during animation
            note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
                [textarea.style.userSelect, textarea.style.pointerEvents] = ['none', 'none'];
            });

            // Calculate the target position relative to the board button
            const [noteRect, boardRect] = [note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect()];
            const [targetX, targetY] = [
                (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2),
                (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2)
            ];

            // Apply CSS custom properties for animation and start the hover effect
            note.style.setProperty('--suckX', `${targetX}px`);
            note.style.setProperty('--suckY', `${targetY}px`);
            note.style.animation = 'noteSuckHover 0.3s ease-out forwards';
            note.classList.add('hover-animating');
        }
    });
}

/**
 * Clears all hover animations and returns notes to their original positions
 * Uses reverse animation to smoothly transition back
 */
function clearHoverAnimations() {
    document.querySelectorAll('.hover-animating').forEach(note => {
        // Re-enable text selection
        note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('pointer-events');
        });
        
        // Start reverse animation to return to original position
        note.style.animation = 'noteSuckReverse 0.3s ease-out forwards';
        note.classList.remove('hover-animating');
        note.classList.add('reverse-animating');
        
        // Clean up after animation completes
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

/**
 * DRAG TRANSFER MESSAGING
 */

/**
 * Shows the drag transfer message when dragging near board area
 * Only displays when multiple boards exist and no specific button is hovered
 */
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

/**
 * Hides the drag transfer message and restores normal UI state
 */
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

/**
 * CLEANUP FUNCTIONS
 */

/**
 * Clears all board button hover states and related animations
 * Used when drag operation ends or is cancelled
 */
function clearBoardButtonHover() {
    document.querySelectorAll('.board-button').forEach(button => button.classList.remove('drag-hover', 'drag-proximity'));
    [hoveredBoardButton] = [null];
    clearHoverAnimations();
    hideDragTransferMessage();
}

/**
 * DROP HANDLING
 */

/**
 * Handles the drop operation when a note is released over a board button
 * Manages both single note and multi-note transfers with position preservation
 * @returns {Object} Object with 'moved' property indicating if transfer occurred
 */
function checkBoardButtonDrop() {
    if (!hoveredBoardButton) return { moved: false };

    const [targetBoardId, notesToMove] = [parseInt(hoveredBoardButton.dataset.boardId), selectedNotes.length > 0 ? [...selectedNotes] : [activeNote]];

    // Handle drop on same board - return notes to original positions
    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => {
            if (note) {
                // Use the original position if available in notesInitialPositions
                const originalPos = notesInitialPositions?.find(pos => pos.element === note);
                if (originalPos) {
                    // Simple animation back to original position
                    note.style.left = `${originalPos.x}px`;
                    note.style.top = `${Math.max(60, originalPos.y)}px`;
                } else {
                    // Fallback to the current behavior if no original position is found
                    note.style.top = `${parseInt(note.style.top || 0) - 250}px`;
                }
            }
        });
        return { moved: false };
    }

    // Calculate relative positions for multi-note transfers
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

    // Execute the transfer for each note
    notesToMove.forEach(note => {
        if (note) moveNoteToBoard(note, targetBoardId, relativePositions.size > 0 ? relativePositions.get(note) : null);
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
        note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
        note.classList.remove('hover-animating');
    } else {
        // Start animation for notes not already animating
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

    // Complete the suction animation
    setTimeout(() => {
        if (note.classList.contains('hover-animating')) {
            note.style.animation = 'noteSuckComplete 0.3s ease-in forwards';
            note.classList.remove('hover-animating');
        }
    }, 300);

    // Final transfer phase - move note to target board
    setTimeout(() => {
        // Re-enable text interaction
        note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
            textarea.style.removeProperty('user-select');
            textarea.style.removeProperty('pointer-events');
        });

        // Remove from current board
        note.remove();

        // Add to target board
        const targetBoard = document.querySelector(`.board[data-board-id="${targetBoardId}"]`);
        if (targetBoard) {
            // Clean up animation properties
            note.style.animation = '';
            note.style.removeProperty('--suckX');
            note.style.removeProperty('--suckY');

            // Set position on target board
            if (relativePosition) {
                // For active board transfers, use the original position if available
                if (relativePosition.originalX !== undefined && relativePosition.originalY !== undefined) {
                    [note.style.left, note.style.top] = [`${relativePosition.originalX}px`, `${Math.max(60, relativePosition.originalY)}px`];
                } else {
                    const [baseLeft, baseTop] = [100, 80];
                    [note.style.left, note.style.top] = [`${baseLeft + relativePosition.offsetX}px`, `${Math.max(60, baseTop + relativePosition.offsetY)}px`];
                }
            } else {
                // Single note transfer - use stored original position or fallback
                const [originalX, originalY] = [parseFloat(note.dataset.originalX), parseFloat(note.dataset.originalY)];
                if (!isNaN(originalX) && !isNaN(originalY)) {
                    [note.style.left, note.style.top] = [`${originalX}px`, `${Math.max(60, originalY)}px`];
                } else {
                    [note.style.left, note.style.top] = [currentLeft, '80px'];
                }
            }

            // Update note metadata and tracking
            const noteId = note.dataset.noteId || generateNoteId();
            [note.dataset.noteId, note.dataset.repositioned] = [noteId, 'true'];
            repositionedNotes.add(noteId);

            // Add to target board with pop animation
            targetBoard.appendChild(note);
            note.style.animation = 'paperPop 0.3s ease-out forwards';

            // Update UI and save state
            updateBoardIndicators();
            clearBoardButtonHover();

            // Temporarily disable hover detection to prevent interference
            hoverDetectionDisabled = true;
            setTimeout(() => hoverDetectionDisabled = false, 500);

            // Save notes on both boards
            const originalBoardId = currentBoardId;
            [currentBoardId] = [targetBoardId];
            saveActiveNotes();
            [currentBoardId] = [originalBoardId];
            saveActiveNotes();
        }
    }, 600);
}
