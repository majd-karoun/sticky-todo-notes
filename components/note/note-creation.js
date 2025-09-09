// Global state
let noteColumns = {},
  repositionedNotes = new Set();

// Utilities
const generateNoteId = () =>
  `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const getRandomOffset = () => Math.random() * 40 - 20;
const getDayColumnIndex = (date = getCurrentDate()) =>
  date.getDay() === 0 ? 0 : date.getDay() - 1;

function showNoteLimitMessage(message) {
  const limitMessage = document.getElementById("noteLimitMessage");
  const textElement = limitMessage?.querySelector(".transfer-text");
  if (textElement) textElement.textContent = message;
  if (limitMessage) {
    limitMessage.classList.add("visible");
    setTimeout(() => limitMessage.classList.remove("visible"), 3000);
  }
}

function addNote() {
  const textarea = $(".note-input textarea");
  const text = textarea.value.trim();
  if (!text) return;

  const boardElement = $(`.board[data-board-id="${currentBoardId}"]`);
  const notes = Array.from(boardElement.querySelectorAll(".sticky-note"));
  const hasWeekdaysPattern = boardElement.classList.contains(
    "board-pattern-weekdays",
  );
  const hasDaysPattern = boardElement.classList.contains("board-pattern-days");
  const hasNoNotes =
    notes.filter((note) => !note.dataset.transferred).length === 0;

  if (!hasWeekdaysPattern && !hasDaysPattern && notes.length >= 30) {
    showNoteLimitMessage(`Maximum notes space reached.`);
    return;
  }

  const nonTransferredNotes = notes.filter((note) => !note.dataset.transferred);
  const lastAddedNote = nonTransferredNotes[nonTransferredNotes.length - 1];
  let { x: lastX, y: lastY } = lastNotePositions[currentBoardId] || {
    x: 0,
    y: 0,
  };
  let lastColor = lastNoteColors[currentBoardId] || getRandomColor();
  let positionX, positionY;

  const getColumnData = (columnIndex, columnCount, excludeNote = null) => {
    const columnWidth = boardElement.offsetWidth / columnCount;
    const baseX = columnIndex * columnWidth + 10;
    const maxX = (columnIndex + 1) * columnWidth - 210;
    const positionX = Math.max(
      baseX,
      Math.min(maxX, baseX + getRandomOffset()),
    );

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

  const findColumnPosition = (startColumn, columnCount) => {
    const bottomThreshold = window.innerHeight - 300;

    for (let attempts = 0; attempts < columnCount; attempts++) {
      const columnIndex = (startColumn + attempts) % columnCount;
      const { positionX: colX, columnNotes } = getColumnData(
        columnIndex,
        columnCount,
      );

      let lastY = 0,
        lastNote = null;
      columnNotes.forEach((note) => {
        const noteY = parsePosition(note.style.top);
        if (noteY > lastY) {
          lastY = noteY;
          lastNote = note;
        }
      });

      const newY = lastNote ? lastY + 70 : 60;
      if (newY <= bottomThreshold) {
        positionX = colX;
        positionY = newY;
        if (lastNote) lastColor = lastNote.style.backgroundColor;
        return true;
      }
    }
    showNoteLimitMessage(`Maximum notes space reached.`);
    return false;
  };

  const handlePatternPositioning = (isWeekday) => {
    let columnIndex;
    const columnCount = isWeekday ? 6 : 5;

    if (lastAddedNote) {
      const noteX = parsePosition(lastAddedNote.style.left);
      const columnWidth = boardElement.offsetWidth / columnCount;
      columnIndex = Math.floor(noteX / columnWidth);
      columnIndex = Math.max(0, Math.min(columnIndex, columnCount - 1));
    } else {
      columnIndex = isWeekday
        ? getDayColumnIndex()
        : getCurrentDayNumber(currentBoardId) || 0;
    }

    return findColumnPosition(columnIndex, columnCount);
  };

  // MAIN POSITIONING LOGIC
  if (hasNoNotes) {
    if (hasWeekdaysPattern || hasDaysPattern) {
      if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
    } else {
      const startX = Math.max(150, window.innerWidth / 4);
      const startY = 50;
      ({ x: positionX, y: positionY } = getNextNotePosition(
        startX,
        startY - 70,
      ));
    }
  } else if (hasWeekdaysPattern || hasDaysPattern) {
    if (handlePatternPositioning(hasWeekdaysPattern) === false) return;
  } else {
    if (lastAddedNote) {
      lastX = parsePosition(lastAddedNote.style.left);
      lastY = parsePosition(lastAddedNote.style.top);
      lastColor = lastAddedNote.style.backgroundColor;
    }
    ({ x: positionX, y: positionY } = getNextNotePosition(lastX, lastY));

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

        if (proposedY <= bottomThreshold) {
          positionY = proposedY;
        } else if (proposedUpwardY >= 50) {
          positionY = proposedUpwardY;
        } else {
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
  lastNotePositions[currentBoardId] = { x: positionX, y: positionY };
  lastNoteColors[currentBoardId] = lastColor;
  textarea.value = "";

  boardElement
    .querySelectorAll('.sticky-note[data-transferred="true"]')
    .forEach((note) => {
      delete note.dataset.transferred;
    });

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

  note.className = "sticky-note";
  note.innerHTML = `<div class="sticky-content ${isBold ? "bold" : ""}" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">${colors.map((c) => `<div class="color-option" style="background-color: ${c}" onclick="changeNoteColor(this, '${c}')"></div>`).join("")}</div>
            </div>
            <button class="bold-toggle ${isBold ? "active" : ""}" onclick="toggleBold(this)">B</button>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>`;

  const noteZIndex = getNextZIndex();

  // Apply styles immediately to ensure they're available for saving
  note.style.cssText = `background-color:${color}; left:${x}px; top:${y}px; width:${width}; height:${height}; z-index:${noteZIndex};`;

  note.dataset.noteId = noteId;
  if (repositioned) {
    note.dataset.repositioned = "true";
    repositionedNotes.add(noteId);
  }

  noteZIndexes[noteId] = noteZIndex;
  saveNoteZIndexes();

  const clickHandler = (e) => {
    if (
      !e.target.closest(
        '.note-controls, .sticky-content[contenteditable="true"]',
      )
    ) {
      bringNoteToFront(note);
    }
  };
  note.addEventListener("click", clickHandler);
  note._eventCleanup = () => note.removeEventListener("click", clickHandler);

  setupNote(note);

  const targetBoard = $(`.board[data-board-id="${boardId}"]`);
  if (!targetBoard) {
    console.error(`Board element with ID ${boardId} not found.`);
    return null;
  }

  targetBoard.appendChild(note);
  if (window.AnimationUtils) {
    window.AnimationUtils.updateStyles(
      note,
      { animation: "paperPop 0.3s ease-out forwards" },
      "high",
    );
  } else {
    note.style.animation = "paperPop 0.3s ease-out forwards";
  }

  if (!isRestored) {
    window.DebouncedStorage.saveHigh(
      `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`,
      getNotesData(),
    );
  }
  return note;
}

function changeNoteColor(option, color) {
  event.stopPropagation();

  const note = option.closest(".sticky-note");
  const notesToChange = note.classList.contains("selected")
    ? $$(".sticky-note.selected")
    : [note];

  notesToChange.forEach((n) => {
    const colorButton = n.querySelector(".color-button");
    n.classList.add("color-transition");
    colorButton.classList.add("color-transition");
    n.style.backgroundColor = color;
    colorButton.style.backgroundColor = color;
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

// Keyboard shortcut handling
const shortcutIcon =
  $("#shortcutIcon") ||
  $(".textarea-container").appendChild(
    Object.assign(document.createElement("div"), {
      className: "shortcut-icon",
      id: "shortcutIcon",
    }),
  );

const updateShortcutIcon = () => {
  shortcutIcon.textContent =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘" : "Ctrl";
};

updateShortcutIcon();

$(".note-input textarea").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    addNote();
  }
});
