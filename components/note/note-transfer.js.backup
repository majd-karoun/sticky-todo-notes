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
    const statusBar = $('.status-bar');
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
        $$('.board-button:not(.disabled)', true).forEach(button => {
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
            const boardButtons = $$('.board-button:not(.disabled)');
            hoveredBoardButton = findClosestButton();
            boardButtons.forEach(button => button.classList.add('drag-active', 'drag-proximity'));
            if (hoveredBoardButton) hoveredBoardButton.classList.add('drag-hover');
            startHoverAnimation();
        } else {
            // Leaving proximity - deactivate buttons and clear animations
            $$('.board-button', true).forEach(button => {
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
                $('.shortcut-hint')?.classList.add('hidden-during-drag');
            } else {
                showDragTransferMessage();
                if (!dragTransferMessageVisible) $('.shortcut-hint')?.classList.remove('hidden-during-drag');
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
    // Get the active note from global state
    const currentActiveNote = window.activeNote || activeNote;
    const [buttonRect, notesToAnimate] = [hoveredBoardButton.getBoundingClientRect(), selectedNotes.length > 0 ? selectedNotes : (currentActiveNote ? [currentActiveNote] : [])];

    notesToAnimate.forEach(note => {
        if (note && !note.classList.contains('reverse-animating') && !note.classList.contains('hover-animating')) {
            // Disable text selection during animation
            note.querySelectorAll('textarea, [contenteditable]').forEach(textarea => {
                if (window.AnimationUtils) {
                    window.AnimationUtils.updateStyles(textarea, {
                        userSelect: 'none',
                        pointerEvents: 'none'
                    });
                } else {
                    [textarea.style.userSelect, textarea.style.pointerEvents] = ['none', 'none'];
                }
            });

            // Calculate the target position relative to the board button
            const [noteRect, boardRect] = [note.getBoundingClientRect(), note.closest('.board').getBoundingClientRect()];
            const [targetX, targetY] = [
                (buttonRect.left - boardRect.left + (buttonRect.width / 2)) - (noteRect.left - boardRect.left) - (noteRect.width / 2),
                (buttonRect.top - boardRect.top + (buttonRect.height / 2)) - (noteRect.top - boardRect.top) - (noteRect.height / 2)
            ];

            // Apply CSS custom properties for animation and start the hover effect
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
    });
}

/**
 * Clears all hover animations and returns notes to their original positions
 * Uses reverse animation to smoothly transition back
 */
function clearHoverAnimations() {
    $$('.hover-animating', true).forEach(note => {
        // Re-enable text selection
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
        
        // Start reverse animation to return to original position
        if (window.AnimationUtils) {
            window.AnimationUtils.updateStyles(note, {
                animation: 'noteSuckReverse 0.3s ease-out forwards'
            });
        } else {
            note.style.animation = 'noteSuckReverse 0.3s ease-out forwards';
        }
        note.classList.remove('hover-animating');
        note.classList.add('reverse-animating');
        
        // Clean up after animation completes
        setTimeout(() => {
            if (note.classList.contains('reverse-animating')) {
                if (window.AnimationUtils) {
                    window.AnimationUtils.updateStyles(note, {
                        animation: 'none',
                        '--suckX': '',
                        '--suckY': ''
                    });
                } else {
                    [note.style.animation] = ['none'];
                    note.style.removeProperty('--suckX');
                    note.style.removeProperty('--suckY');
                }
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
        $('.shortcut-hint')?.classList.add('hidden-during-drag');
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
        $('.shortcut-hint')?.classList.remove('hidden-during-drag');
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
    $$('.board-button', true).forEach(button => button.classList.remove('drag-hover', 'drag-proximity'));
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

    // Get the active note from global state
    const currentActiveNote = window.activeNote || activeNote;
    const [targetBoardId, notesToMove] = [parseInt(hoveredBoardButton.dataset.boardId), selectedNotes.length > 0 ? [...selectedNotes] : [currentActiveNote]];

    // Handle drop on same board - return notes to original positions
    if (targetBoardId === currentBoardId) {
        notesToMove.forEach(note => {
            if (note) {
                // Get target position first
                const originalPos = notesInitialPositions?.find(pos => pos.element === note);
                const targetX = originalPos ? originalPos.x : parseFloat(note.style.left) || 100;
                const targetY = originalPos ? Math.max(60, originalPos.y) : parseInt(note.style.top || 0) - 250;
                
                // Clear any ongoing hover animations and create smooth single motion
                if (note.classList.contains('hover-animating')) {
                    note.classList.remove('hover-animating');
                    // Clear existing animation properties
                    note.style.removeProperty('--suckX');
                    note.style.removeProperty('--suckY');
                    note.style.animation = 'none';
                }
                
                // Apply single smooth transition to target position
                note.style.transition = 'left 0.2s ease-out, top 0.2s ease-out, transform 0.2s ease-out';
                note.style.left = `${targetX}px`;
                note.style.top = `${targetY}px`;
                note.style.transform = 'scale(1)'; // Ensure note stays visible
                
                // Clean up transition after completion
                setTimeout(() => {
                    note.style.transition = '';
                    note.style.transform = '';
                }, 200);
            }
        });
        return { moved: false };
    }

    // Calculate relative positions for multi-note transfers
    let relativePositions = new Map();
    if (notesToMove.length > 1 && typeof notesInitialPositions !== 'undefined' && notesInitialPositions.length > 0) {
        // Store the actual original positions instead of calculating offsets from minimum
        notesInitialPositions.forEach(notePos => {
            if (notePos && notesToMove.includes(notePos.element)) {
                relativePositions.set(notePos.element, { 
                    originalX: notePos.x, 
                    originalY: notePos.y 
                });
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
