// Global state
let repositionedNotes = new Set();
let hasAddedNoteThisSession = false;

// Utils
const generateNoteId = () =>
  `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomOffset = () => Math.random() * 40 - 20;
const getDayColumnIndex = (date = getCurrentDate()) =>
  date.getDay() === 0 ? 0 : date.getDay() - 1;

function showNoteLimitMessage(message) {
  const el = document.getElementById("noteLimitMessage");
  if (!el) return;
  const text = el.querySelector(".transfer-text");
  if (text) text.textContent = message;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3000);
}

/**
 * Main function to add a new note to the current board
 * Handles intelligent positioning based on board patterns and existing notes
 */
function addNote() {
  const textarea = $(".note-input textarea");
  const text = textarea.value.trim();
  if (!text) return;

  // Get board context and analyze existing notes
  const boardElement = $(`.board[data-board-id="${currentBoardId}"]`);
  const notes = Array.from(boardElement.querySelectorAll(".sticky-note"));
  const hasWeekdaysPattern = boardElement.classList.contains(
    "board-pattern-weekdays",
  );
  const hasDaysPattern = boardElement.classList.contains("board-pattern-days");
  const hasNoNotes =
    notes.filter((note) => !note.dataset.transferred).length === 0;

  // Check note limits for regular boards (pattern boards have different limits)
  if (!hasWeekdaysPattern && !hasDaysPattern && notes.length >= 30) {
    showNoteLimitMessage(`Maximum notes space reached.`);
    return;
  }

  // Get positioning context from last note and board state
  const nonTransferredNotes = notes.filter((note) => !note.dataset.transferred);
  const lastAddedNote = nonTransferredNotes[nonTransferredNotes.length - 1];
  let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || {
    x: 0,
    y: 0,
  };
  let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
  let positionX, positionY;

  /**
   * Calculates column positioning data for pattern-based boards
   * @param {number} columnIndex - Which column to analyze (0-based)
   * @param {number} columnCount - Total number of columns
   * @param {Element} excludeNote - Note to exclude from calculations
   * @returns {Object} Column positioning data and existing notes
   */
  const getColumnData = (columnIndex, columnCount, excludeNote = null) => {
    const columnWidth = boardElement.offsetWidth / columnCount;
    const baseX = columnIndex * columnWidth + 10;
    const maxX = (columnIndex + 1) * columnWidth - 210;
    const positionX = Math.max(
      baseX,
      Math.min(maxX, baseX + getRandomOffset()),
    );

    // Find all notes that significantly overlap with this column (50% threshold)
    const allNotes = Array.from(
      boardElement.querySelectorAll(".sticky-note"),
    ).filter((note) => note.style.display !== "none" && note !== excludeNote);
    const columnStartX = columnIndex * columnWidth;
    const columnEndX = (columnIndex + 1) * columnWidth;
    const columnNotes = allNotes.filter((note) => {
      const noteLeft = parsePosition(note.style.left);
      const noteRight = noteLeft + 200;
      const overlapStart = Math.max(noteLeft, columnStartX);
      const overlapEnd = Math.min(noteRight, columnEndX);
      return Math.max(0, overlapEnd - overlapStart) / 200 > 0.5;
    });

    return { positionX, columnNotes };
  };

  /**
   * Finds available position in columns for pattern-based boards
   * @param {number} startColumn - Preferred starting column
   * @param {number} columnCount - Total columns available
   * @returns {boolean} True if position found, false if no space
   */
  const findColumnPosition = (startColumn, columnCount) => {
    const bottomThreshold = window.innerHeight - 300;

    // Try each column starting from preferred column
    for (let attempts = 0; attempts < columnCount; attempts++) {
      const columnIndex = (startColumn + attempts) % columnCount;
      const { positionX: colX, columnNotes } = getColumnData(
        columnIndex,
        columnCount,
      );

      // Find the lowest note in this column to stack below it
      let lastY = 0,
        lastNote = null;
      columnNotes.forEach((note) => {
        const noteY = parsePosition(note.style.top);
        if (noteY > lastY) {
          lastY = noteY;
          lastNote = note;
        }
      });

      // Calculate new position below the last note
      const newY = lastNote ? lastY + 70 : 60;
      if (newY <= bottomThreshold) {
        positionX = colX;
        positionY = newY;
        if (lastNote) lastColor = lastNote.style.backgroundColor; // Inherit color from column
        return true;
      }
    }
    showNoteLimitMessage(`Maximum notes space reached.`);
    return false;
  };

  /**
   * Handles positioning for pattern-based boards (weekdays/days)
   * @param {boolean} isWeekday - True for weekdays pattern, false for days pattern
   * @returns {boolean} True if position found successfully
   */
  const handlePatternPositioning = (isWeekday) => {
    let columnIndex;
    const columnCount = isWeekday ? 6 : 5; // 6 weekdays (Mon-Sat) or 5 days

    // Use current day column only after refresh, otherwise continue from last position
    if (hasAddedNoteThisSession && lastAddedNote) {
      // Continue from last added note's position within session
      const noteX = parsePosition(lastAddedNote.style.left);
      const columnWidth = boardElement.offsetWidth / columnCount;
      columnIndex = Math.floor(noteX / columnWidth);
      columnIndex = Math.max(0, Math.min(columnIndex, columnCount - 1));
    } else {
      // First note after refresh or no notes exist - use current day column
      columnIndex = isWeekday
        ? getDayColumnIndex()
        : getCurrentDayNumber(currentBoardId) || 0;
    }

    return findColumnPosition(columnIndex, columnCount);
  };

  // MAIN POSITIONING LOGIC - Handle different board types and scenarios
  if (hasNoNotes) {
    // First note on the board
    if (hasWeekdaysPattern || hasDaysPattern) {
      if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
    } else {
      // Regular board - place first note in good starting position
      const startX = Math.max(150, window.innerWidth / 4);
      const startY = 50;
      ({ x: positionX, y: positionY } = getNextNotePosition(
        startX,
        startY - 70,
      ));
    }
  } else if (hasWeekdaysPattern || hasDaysPattern) {
    // Pattern boards - use column-based positioning
    if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
  } else {
    // Regular boards - use intelligent free-form positioning
    if (lastAddedNote) {
      lastX = parsePosition(lastAddedNote.style.left);
      lastY = parsePosition(lastAddedNote.style.top);
      lastColor = lastAddedNote.style.backgroundColor;
    }
    ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));

    // Handle vertical breaks when reaching top of screen (line wrapping)
    if (positionY <= 50) {
      const notesInColumn = notes.filter(
        (note) => Math.abs(parsePosition(note.style.left) - positionX) < 150,
      );

      if (notesInColumn.length > 0) {
        const noteYs = notesInColumn.map((note) =>
          parsePosition(note.style.top),
        );
        const lowestY = Math.max(...noteYs);
        const highestY = Math.min(...noteYs);
        const bottomThreshold = window.innerHeight - 300;
        const proposedY = lowestY + 200;
        const proposedUpwardY = highestY - 200;

        // Try placing below existing notes
        if (proposedY <= bottomThreshold) {
          positionY = proposedY;
        } else if (proposedUpwardY >= 50) {
          // Try placing above existing notes
          positionY = proposedUpwardY;
        } else {
          // Column is full - find space in adjacent columns
          const findSpaceInColumns = (startX, direction) => {
            const maxX = window.innerWidth - 200;
            for (
              let testX = startX;
              direction > 0 ? testX <= maxX : testX >= 55;
              testX += direction * 250
            ) {
              const testNotes = notes.filter(
                (note) =>
                  Math.abs(parsePosition(note.style.left) - testX) < 150,
              );
              if (testNotes.length === 0) return { x: testX, y: 50 };

              const testYs = testNotes.map((note) =>
                parsePosition(note.style.top),
              );
              const testLowest = Math.max(...testYs);
              const testHighest = Math.min(...testYs);
              const testDown = testLowest + 200;
              const testUp = testHighest - 200;

              if (testDown <= bottomThreshold) return { x: testX, y: testDown };
              if (testUp >= 50) return { x: testX, y: testUp };
            }
            return null;
          };

          // Search right first, then left
          const space =
            findSpaceInColumns(positionX + 250, 1) ||
            findSpaceInColumns(positionX - 250, -1);
          if (space) {
            positionX = space.x;
            positionY = space.y;
          } else {
            showNoteLimitMessage(`Maximum notes space reached.`);
            return;
          }
        }
      }
    }
  }

  // Create the note with calculated position and styling
  createNote(
    text.replace(/\n/g, "<br>"),
    lastColor,
    positionX,
    positionY,
    false,
    "200px",
    "150px",
    false,
    currentBoardId,
  );

  // Update board state and clean up
  lastNotePositions[currentBoardId] = { x: positionX, y: positionY };
  lastNoteColors[currentBoardId] = lastColor;
  hasAddedNoteThisSession = true; // Mark that we've added a note this session
  textarea.value = "";

  // Clear transferred status from all notes now that positioning is complete
  boardElement
    .querySelectorAll('.sticky-note[data-transferred="true"]')
    .forEach((note) => {
      delete note.dataset.transferred;
    });

  // Save to storage and update UI indicators
  window.DebouncedStorage.saveHigh(
    `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
    getNotesData(),
  );
  updateBoardIndicators();
}

function createNote(
  text,
  color,
  x,
  y,
  isRestored = false,
  width = "200px",
  height = "150px",
  isBold = false,
  boardId = currentBoardId,
  repositioned = false,
) {
  const note = document.createElement("div");
  const noteId = generateNoteId();
  const zIndex = getNextZIndex();

  note.className = "sticky-note";
  note.innerHTML = `<div class="sticky-content ${isBold ? "bold" : ""}" contenteditable="true">${text}</div><div class="note-controls"><div class="color-button" style="background-color: ${color}"><div class="color-palette">${colors.map((c) => `<div class="color-option" style="background-color: ${c}" onclick="changeNoteColor(this, '${c}')"></div>`).join("")}</div></div><button class="bold-toggle ${isBold ? "active" : ""}" onclick="toggleBold(this)">B</button><button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button></div><div class="resize-handle"></div>`;

  note.style.cssText = `background-color:${color}; left:${x}px; top:${y}px; width:${width}; height:${height}; z-index:${zIndex};`;
  note.dataset.noteId = noteId;

  if (repositioned) {
    note.dataset.repositioned = "true";
    repositionedNotes.add(noteId);
  }

  noteZIndexes[noteId] = zIndex;
  saveNoteZIndexes();

  note.addEventListener("click", (e) => {
    if (
      !e.target.closest(
        '.note-controls, .sticky-content[contenteditable="true"]',
      )
    )
      bringNoteToFront(note);
  });

  setupNote(note);

  const board = $(`.board[data-board-id="${boardId}"]`);
  if (!board) return null;

  board.appendChild(note);
  note.style.animation = "paperPop 0.3s ease-out forwards";

  if (!isRestored)
    window.DebouncedStorage.saveHigh(
      `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
      getNotesData(),
    );
  return note;
}

function changeNoteColor(option, color) {
  event.stopPropagation();
  const note = option.closest(".sticky-note");
  const notes = note.classList.contains("selected")
    ? $$(".sticky-note.selected")
    : [note];

  notes.forEach((n) => {
    // Add transition class for smooth color fade
    n.classList.add("color-transition");
    const colorButton = n.querySelector(".color-button");
    colorButton.classList.add("color-transition");
    
    // Apply the new color
    n.style.backgroundColor = color;
    colorButton.style.backgroundColor = color;
    
    // Remove transition class after animation completes
    setTimeout(() => {
      n.classList.remove("color-transition");
      colorButton.classList.remove("color-transition");
    }, 300);
  });

  lastNoteColors[currentBoardId] = color;
  window.DebouncedStorage.saveHigh(
    `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
    getNotesData(),
  );
}

const toggleBold = (button) => {
  const content = button
    .closest(".sticky-note")
    .querySelector(".sticky-content");
  content.classList.toggle("bold");
  button.classList.toggle("active");
  window.DebouncedStorage.saveLow(
    `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
    getNotesData(),
  );
};

// Keyboard shortcut
const icon =
  $("#shortcutIcon") ||
  $(".textarea-container").appendChild(
    Object.assign(document.createElement("div"), {
      className: "shortcut-icon",
      id: "shortcutIcon",
    }),
  );
icon.textContent =
  navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘" : "Ctrl";

$(".note-input textarea").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    addNote();
  }
});
