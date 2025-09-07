// Global state variables for interaction
let hoveredBoardButton = null, dragTransferMessageVisible = false, hoverDetectionDisabled = false, isDragInProgress = false;

function setupNote(note) {
    let isDragging = false, isResizing = false, isEditing = false, startX, startY, initialX, initialY, initialW, initialH, holdTimer;
    const [colorButton, colorPalette, content] = ['.color-button', '.color-palette', '.sticky-content'].map(s => note.querySelector(s));
    const saveContent = () => saveActiveNotes();
    ['blur', 'input'].forEach(event => content.addEventListener(event, saveContent));

    const cancelEditing = e => {
        if (isEditing && !content.contains(e.target)) {
            [isEditing, content.contentEditable] = [false, "false"];
            content.blur();
            document.removeEventListener('click', cancelEditing);
        }
    };

    content.addEventListener('dblclick', e => {
        [isEditing, content.contentEditable] = [true, "true"];
        setTimeout(() => {
            const [range, selection] = [document.createRange(), window.getSelection()];
            if (document.caretRangeFromPoint) {
                const clickRange = document.caretRangeFromPoint(e.clientX, e.clientY);
                if (clickRange) {
                    selection.removeAllRanges();
                    selection.addRange(clickRange);
                }
            } else if (document.caretPositionFromPoint) {
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

    // Z-index hover management
    let originalZIndex = null;
    let isHovering = false;
    
    note.addEventListener('mouseenter', () => {
        if (!isDragging && !isResizing) {
            isHovering = true;
            originalZIndex = note.style.zIndex || '1';
            note.style.zIndex = '9999';
        }
    });
    
    note.addEventListener('mouseleave', () => {
        if (!isDragging && !isResizing && originalZIndex !== null) {
            isHovering = false;
            note.style.zIndex = originalZIndex;
            originalZIndex = null;
        }
    });

    content.addEventListener('blur', () => content.contentEditable = "false");
    content.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) { content.contentEditable = "false"; saveContent(); }
            else {
                const [selection, range] = [window.getSelection(), window.getSelection().getRangeAt(0)];
                const newLine = Object.assign(document.createElement('span'), { innerHTML: '<br>', style: { fontFamily: "'Comic Neue', cursive" }});
                range.deleteContents();
                range.insertNode(newLine);
                range.setStartAfter(newLine);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    });

    const updateLastPosition = () => {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId] = { x: rect.left, y: rect.top };
    };

    let mouseX = 0, mouseY = 0, hoverTimeout = null;
    document.addEventListener('mousemove', e => {
        [mouseX, mouseY] = [e.clientX, e.clientY];
        document.querySelectorAll('.color-palette.visible').forEach(palette => {
            const [rect, button] = [palette.getBoundingClientRect(), palette.closest('.note-controls')?.querySelector('.color-button')];
            if (!button) return;
            const buttonRect = button.getBoundingClientRect();
            const [isNearPalette, isOverButton] = [
                mouseX >= rect.left - 10 && mouseX <= rect.right + 10 && mouseY >= rect.top - 10 && mouseY <= rect.bottom + 10,
                mouseX >= buttonRect.left && mouseX <= buttonRect.right && mouseY >= buttonRect.top && mouseY <= buttonRect.bottom
            ];
            if (isNearPalette || isOverButton) clearTimeout(hoverTimeout);
            else if (palette.classList.contains('visible')) hidePalette();
        });
    });

    const showPalette = () => {
        clearTimeout(hoverTimeout);
        colorPalette.classList.remove('closing');
        colorPalette.classList.add('visible');
        document.querySelectorAll('.color-palette').forEach(p => {
            if (p !== colorPalette) {
                p.classList.add('closing');
                setTimeout(() => p.classList.remove('visible', 'closing'), 180);
            }
        });
    };

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

    colorButton.addEventListener('click', e => {
        e.stopPropagation();
        colorPalette.classList.contains('visible') ? hidePalette() : showPalette();
    });
    ['mouseenter', 'mouseleave'].forEach((event, i) => colorPalette.addEventListener(event, i ? hidePalette : () => clearTimeout(hoverTimeout)));

    const handleInteractionStart = (e, clientX, clientY) => {
        if (e.target.closest('.color-palette, .done-button')) return;
        if (selectedNotes.includes(note) && selectedNotes.length > 1) { handleSelectionMove(e); return; }
        if (!e.shiftKey) clearSelection();
        else if (!selectedNotes.includes(note)) { selectedNotes.push(note); note.classList.add('selected'); }

        e.preventDefault();
        [document.body.style.userSelect, document.body.style.webkitUserSelect] = ['none', 'none'];
        
        // Only update z-index if not currently hovering (to preserve permanent click positioning)
        if (!isHovering) {
            note.style.zIndex = ++globalZIndex;
        } else {
            // Update the stored original z-index for when hover ends
            originalZIndex = ++globalZIndex;
        }
        
        [startX, startY] = [clientX, clientY];
        
        if (e.target.closest('.resize-handle')) {
            [isResizing, initialW, initialH] = [true, note.offsetWidth, note.offsetHeight];
        } else {
            [initialX, initialY] = [parsePosition(note.style.left), parsePosition(note.style.top)];
            [note.dataset.originalX, note.dataset.originalY] = [initialX, initialY];
            holdTimer = setTimeout(() => isDragging = true, 150);
        }
        activeNote = note;
    };

    const handleInteractionMove = (clientX, clientY) => {
        if (!activeNote || activeNote !== note) return;
        if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) clearTimeout(holdTimer);

        if (isDragging) {
            if (!isDragInProgress) {
                isDragInProgress = true;
                document.body.classList.add('drag-in-progress');
            }
            const padding = 5;
            let [newX, newY] = [
                Math.min(Math.max(initialX + clientX - startX, -padding), window.innerWidth - (note.offsetWidth / 4)),
                Math.min(Math.max(initialY + clientY - startY, -padding), window.innerHeight - (note.offsetHeight / 4))
            ];
            [note.style.left, note.style.top] = [`${newX}px`, `${newY}px`];
            showDragTransferMessage();
            checkBoardButtonHover(clientX, clientY);
        }
        if (isResizing) {
            const [minW, minH] = [150, 150];
            const [maxW, maxH] = [window.innerWidth - parsePosition(note.style.left) + 50, window.innerHeight - parsePosition(note.style.top) + 50];
            note.style.width = `${Math.min(Math.max(initialW + clientX - startX, minW), maxW)}px`;
            note.style.height = `${Math.min(Math.max(initialH + clientY - startY, minH), maxH)}px`;
        }
    };

    const handleInteractionEnd = () => {
        clearTimeout(holdTimer);
        [document.body.style.userSelect, document.body.style.webkitUserSelect] = ['', ''];

        if (isDragging || isResizing) {
            if (isDragging) {
                hideDragTransferMessage();
                const dropResult = checkBoardButtonDrop();
                if (!dropResult.moved) {
                    updateLastPosition();
                    checkTrashCollision(note);
                    checkBottomCornerCollision(note);
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

    [['mousedown', e => handleInteractionStart(e, e.clientX, e.clientY)], ['touchstart', e => handleInteractionStart(e, e.touches[0].clientX, e.touches[0].clientY), { passive: false }]].forEach(([event, handler, options]) => note.addEventListener(event, handler, options));
    [['mousemove', e => handleInteractionMove(e.clientX, e.clientY)], ['mouseup', handleInteractionEnd], ['touchmove', e => handleInteractionMove(e.touches[0].clientX, e.touches[0].clientY), { passive: false }], ['touchend', handleInteractionEnd]].forEach(([event, handler, options]) => document.addEventListener(event, handler, options));
}

function hideAllColorPalettes() {
    document.querySelectorAll('.color-palette').forEach(palette => {
        if (palette.style.display !== 'none') {
            palette.classList.add('closing');
            setTimeout(() => { palette.style.display = 'none'; palette.classList.remove('closing'); }, 200);
        }
    });
    activePalette = null;
}

document.addEventListener('click', e => {
    if (activePalette && !e.target.closest('.color-button')) hideAllColorPalettes();
});

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
