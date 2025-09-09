/**
 * NOTE INTERACTION MODULE
 * Handles all user interactions with sticky notes including:
 * - Drag and drop functionality
 * - Resizing notes
 * - Content editing (double-click to edit)
 * - Color palette management
 * - Z-index layering and hover effects
 * - Multi-note selection and movement
 */

// Global state variables for interaction management
let hoveredBoardButton = null, dragTransferMessageVisible = false, hoverDetectionDisabled = false, isDragInProgress = false;

/**
 * Sets up all interaction handlers for a sticky note
 * @param {Element} note - The note element to setup interactions for
 */
function setupNote(note) {
    // Local state for this note's interactions
    let isDragging = false, isResizing = false, isEditing = false, startX, startY, initialX, initialY, initialW, initialH, holdTimer;
    const [colorButton, colorPalette, content] = ['.color-button', '.color-palette', '.sticky-content'].map(s => note.querySelector(s));
    const saveContent = () => saveActiveNotes();
    
    // Store event handlers for cleanup
    const eventHandlers = [];
    
    // Content event handlers
    const contentBlurHandler = () => saveActiveNotes();
    const contentInputHandler = () => saveActiveNotes();
    if (window.EventManager) {
        window.EventManager.registerHandler('blur', contentBlurHandler, content);
        window.EventManager.registerHandler('input', contentInputHandler, content);
    } else {
        content.addEventListener('blur', contentBlurHandler);
        content.addEventListener('input', contentInputHandler);
    }
    eventHandlers.push(
        { element: content, event: 'blur', handler: contentBlurHandler },
        { element: content, event: 'input', handler: contentInputHandler }
    );

    /**
     * Cancels editing mode when clicking outside the note content
     * @param {Event} e - The click event
     */
    const cancelEditing = e => {
        if (isEditing && !content.contains(e.target)) {
            [isEditing, content.contentEditable] = [false, "false"];
            content.blur();
            if (window.EventManager) {
                window.EventManager.unregisterHandler('click', cancelEditing);
            } else {
                document.removeEventListener('click', cancelEditing);
            }
        }
    };

    /**
     * CONTENT EDITING SETUP
     * Double-click to enter edit mode with proper cursor positioning
     */
    const contentDblClickHandler = e => {
        [isEditing, content.contentEditable] = [true, "true"];
        setTimeout(() => {
            const [range, selection] = [document.createRange(), window.getSelection()];
            
            // Try modern browser API first
            if (document.caretRangeFromPoint) {
                const clickRange = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (clickRange) {
                    selection.removeAllRanges();
                    selection.addRange(clickRange);
                }
            } else if (document.caretPositionFromPoint) {
                // Fallback for older browsers
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
        setTimeout(() => {
            if (window.EventManager) {
                window.EventManager.registerHandler('click', cancelEditing);
            } else {
                document.addEventListener('click', cancelEditing);
            }
        }, 0);
        e.stopPropagation();
    };
    if (window.EventManager) {
        window.EventManager.registerHandler('dblclick', contentDblClickHandler, content);
    } else {
        content.addEventListener('dblclick', contentDblClickHandler);
    }
    eventHandlers.push({ element: content, event: 'dblclick', handler: contentDblClickHandler });

    /**
     * Z-INDEX HOVER MANAGEMENT
     * Temporarily brings notes to front on hover for better visibility
     */
    let originalZIndex = null;
    let isHovering = false;
    
    const mouseEnterHandler = () => {
        if (!isDragging && !isResizing) {
            isHovering = true;
            originalZIndex = note.style.zIndex || '1';
            AnimationUtils.updateZIndex(note, getNextZIndex()); // Bring to front temporarily
        }
    };
    
    const mouseLeaveHandler = () => {
        if (!isDragging && !isResizing && originalZIndex !== null) {
            isHovering = false;
            AnimationUtils.updateZIndex(note, getNextZIndex()); // Restore original z-index
            originalZIndex = null;
        }
    };
    
    if (window.EventManager) {
        window.EventManager.registerHandler('mouseenter', mouseEnterHandler, note);
        window.EventManager.registerHandler('mouseleave', mouseLeaveHandler, note);
    } else {
        note.addEventListener('mouseenter', mouseEnterHandler);
        note.addEventListener('mouseleave', mouseLeaveHandler);
    }
    eventHandlers.push(
        { element: note, event: 'mouseenter', handler: mouseEnterHandler },
        { element: note, event: 'mouseleave', handler: mouseLeaveHandler }
    );

    /**
     * CONTENT EDITING KEYBOARD HANDLERS
     */
    const contentBlurHandler2 = () => content.contentEditable = "false";
    const contentKeydownHandler = e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) { 
                // Shift+Enter exits edit mode
                content.contentEditable = "false"; 
                saveContent(); 
            } else {
                // Regular Enter adds line break
                const [selection, range] = [window.getSelection(), window.getSelection().getRangeAt(0)];
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
    };
    
    if (window.EventManager) {
        window.EventManager.registerHandler('blur', contentBlurHandler2, content);
        window.EventManager.registerHandler('keydown', contentKeydownHandler, content);
    } else {
        content.addEventListener('blur', contentBlurHandler2);
        content.addEventListener('keydown', contentKeydownHandler);
    }
    eventHandlers.push(
        { element: content, event: 'blur', handler: contentBlurHandler2 },
        { element: content, event: 'keydown', handler: contentKeydownHandler }
    );

    /**
     * Updates the last known position for this note's board
     */
    const updateLastPosition = () => {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId] = { x: rect.left, y: rect.top };
    };

    /**
     * COLOR PALETTE MANAGEMENT
     * Handles showing/hiding color palettes with smart hover detection
     */
    let hoverTimeout = null;
    
    // Register palette hover detection with consolidated event system
    const paletteHoverHandler = (e, eventState) => {
        const [mouseX, mouseY] = [eventState.mouseX, eventState.mouseY];
        $$('.color-palette.visible').forEach(palette => {
            const [rect, button] = [palette.getBoundingClientRect(), palette.closest('.note-controls')?.querySelector('.color-button')];
            if (!button) return;
            const buttonRect = button.getBoundingClientRect();
            
            // Check if mouse is near palette or over button
            const [isNearPalette, isOverButton] = [
                mouseX >= rect.left - 10 && mouseX <= rect.right + 10 && mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10,
                mouseX >= buttonRect.left && mouseX <= buttonRect.right && mouseY >= buttonRect.top && mouseY <= buttonRect.bottom
            ];
            if (isNearPalette || isOverButton) clearTimeout(hoverTimeout);
            else if (palette.classList.contains('visible')) hidePalette();
        });
    };
    
    // Register with event manager
    if (window.eventManager) {
        window.eventManager.registerHandler('mousemove', paletteHoverHandler, 'note-interaction');
    }

    /**
     * Shows the color palette for this note
     * Hides other visible palettes to prevent overlap
     */
    const showPalette = () => {
        clearTimeout(hoverTimeout);
        colorPalette.classList.remove('closing');
        colorPalette.classList.add('visible');
        
        // Hide other palettes
        $$('.color-palette').forEach(p => {
            if (p !== colorPalette) {
                p.classList.add('closing');
                setTimeout(() => p.classList.remove('visible', 'closing'), 180);
            }
        });
    };

    /**
     * Hides the color palette with delay for better UX
     * Only hides if mouse is truly outside the interactive area
     */
    const hidePalette = () => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            const [rect, buttonRect] = [colorPalette.getBoundingClientRect(), colorButton.getBoundingClientRect()];
            const [isMouseOutside, isMouseOverButton] = [
                mouseX < rect.left - 10 || mouseX > rect.right + 10 || mouseY < rect.top - 10 || mouseY > rect.bottom + 10,
                mouseX >= buttonRect.left && mouseX <= buttonRect.right && mouseY >= buttonRect.top && mouseY <= buttonRect.bottom
            ];
            if (isMouseOutside && !isMouseOverButton) {
                colorPalette.classList.add('closing');
                setTimeout(() => colorPalette.classList.contains('closing') && colorPalette.classList.remove('visible', 'closing'), 180);
            }
        }, 50);
    };

    // Color button click handler
    const colorButtonClickHandler = e => {
        e.stopPropagation();
        colorPalette.classList.contains('visible') ? hidePalette() : showPalette();
    };
    if (window.EventManager) {
        window.EventManager.registerHandler('click', colorButtonClickHandler, colorButton);
    } else {
        colorButton.addEventListener('click', colorButtonClickHandler);
    }
    eventHandlers.push({ element: colorButton, event: 'click', handler: colorButtonClickHandler });
    
    // Palette hover handlers
    const paletteMouseEnterHandler = () => clearTimeout(hoverTimeout);
    const paletteMouseLeaveHandler = () => hidePalette();
    if (window.EventManager) {
        window.EventManager.registerHandler('mouseenter', paletteMouseEnterHandler, colorPalette);
        window.EventManager.registerHandler('mouseleave', paletteMouseLeaveHandler, colorPalette);
    } else {
        colorPalette.addEventListener('mouseenter', paletteMouseEnterHandler);
        colorPalette.addEventListener('mouseleave', paletteMouseLeaveHandler);
    }
    eventHandlers.push(
        { element: colorPalette, event: 'mouseenter', handler: paletteMouseEnterHandler },
        { element: colorPalette, event: 'mouseleave', handler: paletteMouseLeaveHandler }
    );

    /**
     * DRAG AND DROP INTERACTION HANDLERS
     * Handles the start of drag/resize interactions
     * @param {Event} e - The mouse event
     * @param {number} clientX - X coordinate of the interaction
     * @param {number} clientY - Y coordinate of the interaction
     */
    const handleInteractionStart = (e, clientX, clientY) => {
        // Ignore interactions on color palette and done button
        if (e.target.closest('.color-palette, .done-button')) return;
        
        // Handle multi-note selection movement
        if (selectedNotes.includes(note) && selectedNotes.length > 1) { handleSelectionMove(e); return; }
        
        // Selection management
        if (!e.shiftKey) clearSelection();
        else if (!selectedNotes.includes(note)) { selectedNotes.push(note); note.classList.add('selected'); }

        e.preventDefault();
        [document.body.style.userSelect, document.body.style.webkitUserSelect] = ['none', 'none'];
        
        // Z-index management - bring note to front
        if (!isHovering) {
            AnimationUtils.updateZIndex(note, getNextZIndex());
        } else {
            // Update the stored original z-index for when hover ends
            originalZIndex = getNextZIndex();
        }
        
        [startX, startY] = [clientX, clientY];
        
        // Determine interaction type: resize or drag
        if (e.target.closest('.resize-handle')) {
            [isResizing, initialW, initialH] = [true, note.offsetWidth, note.offsetHeight];
        } else {
            [initialX, initialY] = [parsePosition(note.style.left), parsePosition(note.style.top)];
            [note.dataset.originalX, note.dataset.originalY] = [initialX, initialY];
            holdTimer = setTimeout(() => isDragging = true, 150); // Delay before drag starts
        }
        
        // Update global event state
        if (window.eventManager) {
            window.eventManager.eventState.activeNote = note;
        } else {
            // Fallback for when EventManager is not available
            window.activeNote = note;
        }
    };

    /**
     * Handles movement during drag/resize operations
     * @param {Event} e - Mouse event
     * @param {Object} eventState - Global event state
     */
    const handleInteractionMove = (e, eventState) => {
        if (!eventState.activeNote || eventState.activeNote !== note) return;
        
        const [clientX, clientY] = [e.clientX, e.clientY];
        
        // Cancel hold timer if significant movement detected and start dragging immediately
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) {
            clearTimeout(holdTimer);
            if (!isDragging && !isResizing) {
                isDragging = true;
            }
        }

        if (isDragging) {
            // Set drag state for visual feedback
            if (!eventState.isDragInProgress) {
                eventState.isDragInProgress = true;
                document.body.classList.add('drag-in-progress');
            }
            
            // Calculate new position with boundary constraints
            const padding = 5;
            let [newX, newY] = [
                Math.min(Math.max(initialX + clientX - startX, -padding), window.innerWidth - (note.offsetWidth / 4)),
                Math.min(Math.max(initialY + clientY - startY, -padding), window.innerHeight - (note.offsetHeight / 4))
            ];
            if (window.AnimationBatcher) {
                window.AnimationBatcher.batchStyleUpdate(note, {
                    left: `${newX}px`,
                    top: `${newY}px`
                });
            } else {
                note.style.left = `${newX}px`;
                note.style.top = `${newY}px`;
            }
            
            // Show transfer UI and check for board hover
            showDragTransferMessage();
            checkBoardButtonHover(clientX, clientY);
        }
        
        if (isResizing) {
            // Handle note resizing with min/max constraints
            const [minW, minH] = [150, 150];
            const [maxW, maxH] = [window.innerWidth - parsePosition(note.style.left) + 50, window.innerHeight - parsePosition(note.style.top) + 50];
            const newWidth = Math.min(Math.max(initialW + clientX - startX, minW), maxW);
            const newHeight = Math.min(Math.max(initialH + clientY - startY, minH), maxH);
            if (window.AnimationBatcher) {
                window.AnimationBatcher.batchStyleUpdate(note, {
                    width: `${newWidth}px`,
                    height: `${newHeight}px`
                });
            } else {
                note.style.width = `${newWidth}px`;
                note.style.height = `${newHeight}px`;
            }
        }
    };

    /**
     * Handles the end of drag/resize interactions
     * Processes drop targets, collision detection, and cleanup
     */
    const handleInteractionEnd = (e, eventState) => {
        clearTimeout(holdTimer);
        [document.body.style.userSelect, document.body.style.webkitUserSelect] = ['', ''];

        if (isDragging || isResizing) {
            if (isDragging) {
                hideDragTransferMessage();
                
                // Check if note was dropped on a board button for transfer
                const dropResult = checkBoardButtonDrop();
                if (!dropResult.moved) {
                    // Note stayed on current board - handle positioning and collisions
                    updateLastPosition();
                    checkTrashCollision(note);
                    checkBottomCornerCollision(note);
                    
                    // Update note metadata
                    const noteId = note.dataset.noteId || generateNoteId();
                    [note.dataset.noteId, note.dataset.repositioned] = [noteId, 'true'];
                    repositionedNotes.add(noteId);
                    lastNotePositions[currentBoardId] = { x: parsePosition(note.style.left), y: parsePosition(note.style.top) };
                    lastNoteColors[currentBoardId] = note.style.backgroundColor;
                    updateBoardIndicators();
                    clearBoardButtonHover();
                    eventState.activeNote = null;
                    // Also clear fallback activeNote
                    if (window.activeNote) {
                        window.activeNote = null;
                    }
                }
                // Use debounced storage for better performance during frequent drag operations
                if (window.DebouncedStorage) {
                    window.DebouncedStorage.saveHigh(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
                } else {
                    saveActiveNotes();
                }
                [eventState.isDragInProgress, document.body.classList] = [false, document.body.classList.remove('drag-in-progress')];
            }
        }
        [isDragging, isResizing] = [false, false];
        hideDragTransferMessage();
    };

    /**
     * EVENT LISTENER SETUP
     * Attach mouse event handlers for drag/resize functionality
     */
    const noteMouseDownHandler = e => handleInteractionStart(e, e.clientX, e.clientY);
    
    if (window.EventManager) {
        window.EventManager.registerHandler('mousedown', noteMouseDownHandler, note);
    } else {
        note.addEventListener('mousedown', noteMouseDownHandler);
    }
    
    // Register with consolidated event system
    if (window.eventManager) {
        window.eventManager.registerHandler('mousemove', handleInteractionMove, `note-${note.dataset.noteId || Date.now()}`);
        window.eventManager.registerHandler('mouseup', handleInteractionEnd, `note-${note.dataset.noteId || Date.now()}`);
    }
    
    eventHandlers.push(
        { element: note, event: 'mousedown', handler: noteMouseDownHandler }
    );
    
    // Store cleanup function on the note element for later removal
    const noteModuleId = `note-${note.dataset.noteId || Date.now()}`;
    
    if (note._eventCleanup) {
        // Merge with existing cleanup function
        const existingCleanup = note._eventCleanup;
        note._eventCleanup = () => {
            existingCleanup();
            eventHandlers.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            // Cleanup consolidated event handlers
            if (window.eventManager) {
                window.eventManager.unregisterModule(noteModuleId);
            }
        };
    } else {
        note._eventCleanup = () => {
            eventHandlers.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            // Cleanup consolidated event handlers
            if (window.eventManager) {
                window.eventManager.unregisterModule(noteModuleId);
            }
        };
    }
}

/**
 * GLOBAL COLOR PALETTE MANAGEMENT
 */

/**
 * Hides all visible color palettes
 * Used when clicking outside or switching between notes
 */
function hideAllColorPalettes() {
    $$('.color-palette').forEach(palette => {
        if (palette.style.display !== 'none') {
            palette.classList.add('closing');
            setTimeout(() => { palette.style.display = 'none'; palette.classList.remove('closing'); }, 200);
        }
    });
    activePalette = null;
}

// Global click handler to hide palettes when clicking outside
const globalPaletteClickHandler = e => {
    if (activePalette && !e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
};

if (window.EventManager) {
    window.EventManager.registerHandler('click', globalPaletteClickHandler);
} else {
    document.addEventListener('click', globalPaletteClickHandler);
}

/**
 * COLLISION DETECTION
 */

/**
 * Checks if a note collides with the bottom-left corner UI area
 * Automatically moves notes up if they overlap with restricted areas
 * @param {Element} note - The note element to check
 */
function checkBottomCornerCollision(note) {
    if (!note) return;
    const [noteRect, screenHeight, restrictedWidth, restrictedHeight] = [note.getBoundingClientRect(), window.innerHeight, 250, 150];
    const restrictedTop = screenHeight - restrictedHeight;
    const [overlapsVertically, overlapsBottomLeft] = [noteRect.bottom > restrictedTop, noteRect.left < restrictedWidth && noteRect.bottom > restrictedTop];

    if (overlapsBottomLeft) {
        const [moveUpDistance, currentTop, newTop] = [noteRect.bottom - restrictedTop + 20, parsePosition(note.style.top), Math.max(60, parsePosition(note.style.top) - (noteRect.bottom - restrictedTop + 20))];
        note.style.transition = 'top 0.3s ease-out';
        note.style.top = `${newTop}px`;
        setTimeout(() => note.style.transition = '', 300);
    }
}
