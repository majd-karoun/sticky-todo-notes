/**
 * NOTE INTERACTION MODULE - Simplified
 * Core functionality: drag, resize, edit, color palette
 */

// Global state
let isDragInProgress = false;
let hoveredBoardButton = null;
let dragTransferMessageVisible = false;
let hoverDetectionDisabled = false;

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
    e.stopPropagation();
  });

  content.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      content.contentEditable = "false";
      saveActiveNotes();
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
    paletteTimeout = setTimeout(
      () => colorPalette.classList.remove("visible"),
      100,
    );
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
      }

      const newX = Math.max(0, initialX + e.clientX - startX);
      const newY = Math.max(0, initialY + e.clientY - startY);

      note.style.left = newX + "px";
      note.style.top = newY + "px";

      checkBoardButtonHover(e.clientX, e.clientY);
    }

    if (isResizing) {
      const newWidth = Math.max(150, initialW + e.clientX - startX);
      const newHeight = Math.max(150, initialH + e.clientY - startY);

      note.style.width = newWidth + "px";
      note.style.height = newHeight + "px";
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

        lastNotePositions[currentBoardId] = {
          x: parsePosition(note.style.left),
          y: parsePosition(note.style.top),
        };
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
  $$(".color-palette").forEach((p) => p.classList.remove("visible"));
}

// Hide palettes when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".color-button, .color-palette")) {
    hideAllColorPalettes();
  }
});

// Move note up if it overlaps bottom corner
function checkBottomCornerCollision(note) {
  if (!note) return;
  const rect = note.getBoundingClientRect();
  if (rect.left < 250 && rect.bottom > window.innerHeight - 150) {
    const overlap = rect.bottom - (window.innerHeight - 150);
    const newTop = Math.max(60, parsePosition(note.style.top) - overlap - 20);
    note.style.top = newTop + "px";
  }
}

