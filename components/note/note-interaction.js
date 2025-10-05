/**
 * NOTE INTERACTION MODULE - Simplified
 * Core functionality: drag, resize, edit, color palette
 */

// Global state
let isDragInProgress = false;

function setupNote(note) {
  const content = note.querySelector(".sticky-content");
  const colorButton = note.querySelector(".color-button");
  const colorPalette = note.querySelector(".color-palette");

  let isDragging = false;
  let isResizing = false;
  let startX, startY, initialX, initialY, initialW, initialH;

  // Content editing
  content.addEventListener("input", saveActiveNotes);
  content.addEventListener("blur", saveActiveNotes);

  content.addEventListener("dblclick", (e) => {
    content.contentEditable = "true";
    content.focus();
    
    // Move cursor to end of text
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(content);
    range.collapse(false); // false = collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
    
    e.stopPropagation();
  });

  content.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      content.contentEditable = "false";
      saveActiveNotes();
    }
  });

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
      note.style.zIndex = '9999'; // Bring to front temporarily
    }
  };
  
  const mouseLeaveHandler = () => {
    if (!isDragging && !isResizing && originalZIndex !== null) {
      isHovering = false;
      note.style.zIndex = originalZIndex; // Restore original z-index
      originalZIndex = null;
    }
  };
  
  note.addEventListener('mouseenter', mouseEnterHandler);
  note.addEventListener('mouseleave', mouseLeaveHandler);

  // Click to bring to front permanently with proper z-index management
  note.addEventListener('click', (e) => {
    if (!e.target.closest('.color-palette, .resize-handle')) {
      e.stopPropagation();
      
      // Z-index management - bring note to front permanently
      if (!isHovering) {
        note.style.zIndex = ++globalZIndex;
      } else {
        // Update the stored original z-index for when hover ends
        originalZIndex = ++globalZIndex;
        note.style.zIndex = '9999'; // Keep temporary hover state
      }
      
      // Update tracking
      const noteId = note.dataset.noteId || generateNoteId();
      note.dataset.noteId = noteId;
      noteZIndexes[noteId] = globalZIndex;
      saveNoteZIndexes();
    }
  });

  // Color palette
  let paletteTimeout;

  colorButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (colorPalette.classList.contains("visible")) {
      colorPalette.classList.remove("visible");
    } else {
      $$(".color-palette").forEach((p) => p.classList.remove("visible"));
      colorPalette.classList.add("visible");
    }
  });

  colorPalette.addEventListener("mouseenter", () =>
    clearTimeout(paletteTimeout),
  );
  colorPalette.addEventListener("mouseleave", () => {
    paletteTimeout = setTimeout(() => {
      colorPalette.classList.add("closing");
      setTimeout(() => {
        colorPalette.classList.remove("visible", "closing");
      }, 180); // Match animation duration
    }, 100);
  });

  // Drag and resize - old system
  note.addEventListener("mousedown", (e) => {
    if (e.target.closest(".color-palette")) return;

    if (selectedNotes.includes(note) && selectedNotes.length > 1) {
      return handleSelectionMove(e);
    }

    if (!e.shiftKey) {
      clearSelection();
    } else if (!selectedNotes.includes(note)) {
      selectedNotes.push(note);
      note.classList.add("selected");
    }

    e.preventDefault();
    document.body.style.userSelect = "none";

    startX = e.clientX;
    startY = e.clientY;

    if (e.target.closest(".resize-handle")) {
      isResizing = true;
      initialW = note.offsetWidth;
      initialH = note.offsetHeight;
    } else {
      isDragging = true;
      initialX = parsePosition(note.style.left);
      initialY = parsePosition(note.style.top);
      // Set active note for transfer system
      window.activeNote = note;
      // Store initial position for transfer system (same as multi-note selection)
      notesInitialPositions = [{ 
        element: note, 
        x: initialX, 
        y: initialY 
      }];
      // Also store position in data attributes for same-board transfer fallback
      note.dataset.preDragX = initialX.toString();
      note.dataset.preDragY = initialY.toString();
    }

    // Add event listeners directly to document
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
  });

  function handleMove(e) {
    if (isDragging) {
      if (!isDragInProgress) {
        isDragInProgress = true;
        document.body.classList.add("drag-in-progress");
        // Show drag message when drag starts
        if (typeof showDragTransferMessage === 'function') {
          showDragTransferMessage();
        }
      }

      const newX = Math.max(0, initialX + e.clientX - startX);
      const newY = Math.max(0, initialY + e.clientY - startY);

      window.AnimationUtils.updatePosition(note, newX, newY);

      checkBoardButtonHover(e.clientX, e.clientY);
    }

    if (isResizing) {
      const newWidth = Math.max(150, initialW + e.clientX - startX);
      const newHeight = Math.max(150, initialH + e.clientY - startY);

      window.AnimationUtils.updateSize(note, newWidth, newHeight);
    }
  }

  function handleEnd(e) {
    // Remove event listeners
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    
    document.body.style.userSelect = "";

    if (isDragging) {
      hideDragTransferMessage();
      const dropResult = checkBoardButtonDrop();

      if (!dropResult.moved) {
        checkTrashCollision(note);
        checkBottomCornerCollision(note);

        const noteId = note.dataset.noteId || generateNoteId();
        note.dataset.noteId = noteId;
        note.dataset.repositioned = "true";
        repositionedNotes.add(noteId);

        // Only update lastNotePositions if this wasn't a same-board transfer
        // Same-board transfers should restore to original position, not current position
        if (!note.dataset.preDragX || !note.dataset.preDragY) {
          lastNotePositions[currentBoardId] = {
            x: parsePosition(note.style.left),
            y: parsePosition(note.style.top),
          };
        }
        lastNoteColors[currentBoardId] = note.style.backgroundColor;
      }

      isDragInProgress = false;
      document.body.classList.remove("drag-in-progress");
    }

    // Clear active note
    window.activeNote = null;

    // Save after both drag and resize operations
    if (isDragging || isResizing) {
      window.DebouncedStorage.save(
        `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
        getNotesData(),
      );
    }

    isDragging = false;
    isResizing = false;
  }
}

// Hide all color palettes
function hideAllColorPalettes() {
  $$(".color-palette.visible").forEach((p) => {
    p.classList.add("closing");
    setTimeout(() => {
      p.classList.remove("visible", "closing");
    }, 180); // Match animation duration
  });
}

// Hide palettes when clicking outside and unfocus note editing
document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-button, .color-palette")) {
    hideAllColorPalettes();
  }
  
  // Unfocus note editing when clicking outside
  if (!e.target.closest(".sticky-note")) {
    const editableContent = document.querySelector('.sticky-content[contenteditable="true"]');
    if (editableContent) {
      editableContent.contentEditable = "false";
      editableContent.blur();
      saveActiveNotes();
    }
  }
});

// Move note up if it overlaps bottom corner
function checkBottomCornerCollision(note) {
  if (!note) return;
  const rect = note.getBoundingClientRect();
  if (rect.left < 250 && rect.bottom > window.innerHeight - 150) {
    const overlap = rect.bottom - (window.innerHeight - 150);
    const newTop = Math.max(60, parsePosition(note.style.top) - overlap - 20);
    window.AnimationUtils.updateStyles(note, { top: `${newTop}px` });
  }
}

