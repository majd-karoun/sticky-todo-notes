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
    ['blur', 'input'].forEach(event => content.addEventListener(event, saveContent));

    /**
     * Cancels editing mode when clicking outside the note content
     * @param {Event} e - The click event
     */
    const cancelEditing = e => {
        if (isEditing && !content.contains(e.target)) {
            [isEditing, content.contentEditable] = [false, "false"];
            content.blur();
            document.removeEventListener('click', cancelEditing);
        }
    };

    /**
     * CONTENT EDITING SETUP
     * Double-click to enter edit mode with proper cursor positioning
     */
    content.addEventListener('dblclick', e => {
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
        setTimeout(() => document.addEventListener('click', cancelEditing), 0);
        e.stopPropagation();
    });

    /**
     * Z-INDEX HOVER MANAGEMENT
     * Temporarily brings notes to front on hover for better visibility
     */
    let originalZIndex = null;
    let isHovering = false;
    
    note.addEventListener('mouseenter', () => {
        if (!isDragging && !isResizing) {
            isHovering = true;
            originalZIndex = note.style.zIndex || '1';
            note.style.zIndex = '9999'; // Bring to front temporarily
        }
    });
    
    note.addEventListener('mouseleave', () => {
        if (!isDragging && !isResizing && originalZIndex !== null) {
            isHovering = false;
            note.style.zIndex = originalZIndex; // Restore original z-index
            originalZIndex = null;
        }
    });

    /**
     * CONTENT EDITING KEYBOARD HANDLERS
     */
    content.addEventListener('blur', () => content.contentEditable = "false");
    content.addEventListener('keydown', e => {
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
    });

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
    let mouseX = 0, mouseY = 0, hoverTimeout = null;
    document.addEventListener('mousemove', e => {
        [mouseX, mouseY] = [e.clientX, e.clientY];
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
    });

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
    colorButton.addEventListener('click', e => {
        e.stopPropagation();
        colorPalette.classList.contains('visible') ? hidePalette() : showPalette();
    });
    
    // Palette hover handlers
    ['mouseenter', 'mouseleave'].forEach((event, i) => colorPalette.addEventListener(event, i ? hidePalette : () => clearTimeout(hoverTimeout)));

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
            note.style.zIndex = ++globalZIndex;
        } else {
            // Update the stored original z-index for when hover ends
            originalZIndex = ++globalZIndex;
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
        activeNote = note;
    };

    /**
     * Handles movement during drag/resize operations
     * @param {number} clientX - Current X coordinate
     * @param {number} clientY - Current Y coordinate
     */
    const handleInteractionMove = (clientX, clientY) => {
        if (!activeNote || activeNote !== note) return;
        
        // Cancel hold timer if significant movement detected
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) clearTimeout(holdTimer);

        if (isDragging) {
            // Set drag state for visual feedback
            if (!isDragInProgress) {
                isDragInProgress = true;
                document.body.classList.add('drag-in-progress');
            }
            
            // Calculate new position with boundary constraints
            const padding = 5;
            let [newX, newY] = [
                Math.min(Math.max(initialX + clientX - startX, -padding), window.innerWidth - (note.offsetWidth / 4)),
                Math.min(Math.max(initialY + clientY - startY, -padding), window.innerHeight - (note.offsetHeight / 4))
            ];
            [note.style.left, note.style.top] = [`${newX}px`, `${newY}px`];
            
            // Show transfer UI and check for board hover
            showDragTransferMessage();
            checkBoardButtonHover(clientX, clientY);
        }
        
        if (isResizing) {
            // Handle note resizing with min/max constraints
            const [minW, minH] = [150, 150];
            const [maxW, maxH] = [window.innerWidth - parsePosition(note.style.left) + 50, window.innerHeight - parsePosition(note.style.top) + 50];
            note.style.width = `${Math.min(Math.max(initialW + clientX - startX, minW), maxW)}px`;
            note.style.height = `${Math.min(Math.max(initialH + clientY - startY, minH), maxH)}px`;
        }
    };

    /**
     * Handles the end of drag/resize interactions
     * Processes drop targets, collision detection, and cleanup
     */
    const handleInteractionEnd = () => {
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
                    activeNote = null;
                }
                saveActiveNotes();
                [isDragInProgress, document.body.classList] = [false, document.body.classList.remove('drag-in-progress')];
            }
        }
        [isDragging, isResizing] = [false, false];
        hideDragTransferMessage();
    };

    /**
     * EVENT LISTENER SETUP
     * Attach mouse event handlers for drag/resize functionality
     */
    note.addEventListener('mousedown', e => handleInteractionStart(e, e.clientX, e.clientY));
    document.addEventListener('mousemove', e => handleInteractionMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', handleInteractionEnd);
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
document.addEventListener('click', e => {
    if (activePalette && !e.target.closest('.color-button')) hideAllColorPalettes();
});

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
