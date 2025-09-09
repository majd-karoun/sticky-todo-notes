// DOM utilities - cached querySelector functions
/**
 * UTILITIES MODULE
 * Core utility functions and global state management for the sticky notes app
 * Features:
 * - Global state variables and constants
 * - Position calculation and note layout algorithms
 * - Data persistence (localStorage management)
 * - Z-index layering system
 * - Color and styling utilities
 */

// GLOBAL CONSTANTS AND STATE

// Available note colors for the color palette
const colors = [
  "#f0e68c",
  "#98ff98",
  "#ff7eb9",
  "#7afcff",
  "#FE8801",
  "#ec0c39",
  "#AF65EF",
  "#ffd700",
  "#C1C1C1",
  "#FFFFFF",
];

// Board styling configuration
const boardStyles = {
  colors: {
    default: "#1a1a1a",
    current: "#1a1a1a",
    available: [
      "#1a1a1a",
      "#500000",
      "#004000",
      "#000050",
      "#10253F",
      "#400040",
    ],
  },
  patterns: { default: "none", current: "none" },
};

// Global state variables
let deletedNotes = [];
let holdTimer,
  activeNote = null,
  activePalette = null;
let isSelecting = false,
  selectionBox = null,
  selectionStartX = 0,
  selectionStartY = 0;
let selectedNotes = [],
  isMovingSelection = false,
  selectionMoveStartX = 0,
  selectionMoveStartY = 0;
let notesInitialPositions = [];
const lastNotePositions = {},
  lastNoteColors = {},
  noteZIndexes = {};
let globalZIndex = 1000;
lastNotePositions[1] = {
  x: window.innerWidth / 2 - 100,
  y: window.innerHeight / 2 - 75,
};
lastNoteColors[1] = colors[0];
let currentBoardId = 1,
  boardCount = 1;
const MAX_BOARDS = 9;

// localStorage keys for data persistence
const ACTIVE_NOTES_KEY = "stickyNotes_active",
  DELETED_NOTES_KEY = "stickyNotes_deleted",
  BOARDS_COUNT_KEY = "stickyNotes_boardCount",
  NOTE_ZINDEX_KEY = "stickyNotes_zIndexes";

// POSITION AND LAYOUT UTILITIES

/**
 * Parses CSS position values (removes 'px' and converts to integer)
 * @param {string|number} value - The position value to parse
 * @returns {number} Parsed integer value or 0 if invalid
 */
const parsePosition = (value) => parseInt(String(value).replace("px", "")) || 0;

/**
 * Checks if a position would overlap with existing notes' top edges
 * @param {number} x - X coordinate to check
 * @param {number} y - Y coordinate to check
 * @param {number} noteHeight - Height of the note (default 150px)
 * @returns {boolean} True if position would cover another note's top edge
 */
const wouldCoverNoteTopEdge = (x, y, noteHeight = 150) => {
  const boardElement = $(
    `.board[data-board-id="${currentBoardId}"]`
  );
  if (!boardElement) return false;

  const existingNotes = Array.from(boardElement.querySelectorAll(".sticky-note"));
  const tolerance = 20; // Pixels of tolerance for overlap detection

  for (const note of existingNotes) {
    const noteX = parsePosition(note.style.left);
    const noteY = parsePosition(note.style.top);
    const noteWidth = parsePosition(note.style.width) || 200;

    // Check if new note would horizontally overlap with existing note
    const horizontalOverlap =
      x < noteX + noteWidth + tolerance && x + 200 > noteX - tolerance;

    // Check if new note's bottom edge would cover existing note's top edge area
    const newNoteBottom = y + noteHeight;
    const topEdgeArea = noteY + 30; // Consider top 30px as "top edge area"
    const verticalCover = y < topEdgeArea && newNoteBottom > noteY - tolerance;

    if (horizontalOverlap && verticalCover) {
      return true;
    }
  }
  return false;
};

/**
 * Calculates the next position for a new note using intelligent layout algorithm
 * Implements column-based wrapping with natural positioning variations and collision avoidance
 * @param {number} lastX - X coordinate of the last placed note
 * @param {number} lastY - Y coordinate of the last placed note
 * @returns {Object} Object with x and y coordinates for the new note
 */
const getNextNotePosition = (lastX, lastY) => {
  const horizontalOffset = Math.random() * 10 - 5; // Add natural variation
  let newX = lastX + horizontalOffset,
    newY = lastY + 70;
  const padding = 5,
    maxX = window.innerWidth - 200; // Account for full note width
  const bottomThreshold = window.innerHeight - 300; // Break line when reaching 300px from bottom
  const maxAttempts = 20; // Prevent infinite loops
  let attempts = 0;

  // Keep trying positions until we find one that doesn't cover another note's top edge
  while (attempts < maxAttempts && wouldCoverNoteTopEdge(newX, newY)) {
    newY += 40; // Move down by smaller increments to find next available space
    attempts++;

    // If we've tried many positions vertically and still have conflicts, try next column
    if (attempts > 10) {
      newX = lastX + 250; // Move to next column
      newY = 50; // Reset to top
      attempts = 0; // Reset attempt counter for new column
    }
  }

  // If the new position would be too close to the bottom, start a new line
  if (newY > bottomThreshold) {
    newY = 50; // Start new line at top
    newX = lastX + 250; // Move to next column (note width + more spacing)

    // Check collision again in new column
    while (attempts < maxAttempts && wouldCoverNoteTopEdge(newX, newY)) {
      newY += 40;
      attempts++;
    }

    // If we've reached the right edge, start from the far left again
    if (newX > maxX) {
      newX = padding + 50; // Start from far left with some padding
      newY = 50; // Keep at top for new row

      // Final collision check from the left
      attempts = 0;
      while (attempts < maxAttempts && wouldCoverNoteTopEdge(newX, newY)) {
        newY += 40;
        attempts++;
      }
    }
  }

  // Ensure position is within bounds
  const finalX = Math.min(Math.max(newX, padding), maxX);
  const finalY = Math.min(Math.max(newY, padding), window.innerHeight - 100);

  return { x: finalX, y: finalY };
};

// COLOR UTILITIES

/**
 * Converts hex or rgba color values to RGB object
 * @param {string} hex - Hex color string (#fff, #ffffff) or rgba string
 * @returns {Object|null} RGB object with r, g, b properties or null if invalid
 */
const hexToRgb = (hex) => {
  if (hex.startsWith("rgba")) {
    const parts = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return parts
      ? { r: parseInt(parts[1]), g: parseInt(parts[2]), b: parseInt(parts[3]) }
      : null;
  }
  hex = hex.replace(
    /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
    (m, r, g, b) => r + r + g + g + b + b,
  );
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const saveToLocalStorage = (key, data, immediate = false) => {
  try {
    // Always save immediately for now to prevent data loss during optimization
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error);
  }
};

const saveActiveNotes = (immediate = false) => {
  if (immediate) {
    window.DebouncedStorage.flush(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`);
    window.DebouncedStorage.save(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
  } else {
    window.DebouncedStorage.save(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, getNotesData());
  }
  if (typeof updateBoardIndicators === "function") updateBoardIndicators();
};

const getNotesData = () => {
  const boardElement = $(
    `.board[data-board-id="${currentBoardId}"]`
  );
  if (!boardElement) return [];
  const notes = Array.from(boardElement.querySelectorAll(".sticky-note"));
  return Array.from(notes).map((note) => ({
    content: $within(note, ".sticky-content").textContent,
    x: parsePosition(note.style.left),
    y: parsePosition(note.style.top),
    color: note.style.backgroundColor || "#ffeb3b",
    width: note.style.width || "200px",
    height: note.style.height || "150px",
    isBold: $within(note, ".sticky-content").classList.contains("bold"),
    noteId: note.dataset.noteId,
    zIndex: note.style.zIndex || 1,
  }));
};

const saveDeletedNotes = () => {
  window.DebouncedStorage.saveLow(DELETED_NOTES_KEY, deletedNotes);
};

const saveBoardCount = () => {
  window.DebouncedStorage.save(BOARDS_COUNT_KEY, boardCount.toString());
};
const saveBoardStyles = () => {
  const boardStyleData = {
    color: boardStyles.colors.current,
    pattern: boardStyles.patterns.current,
  };
  window.DebouncedStorage.saveLow(`boardStyles_board_${currentBoardId}`, boardStyleData);
};

const updateShortcutIconDisplay = () => {
  const shortcutIconEl = $("#shortcutIcon");
  if (!shortcutIconEl) return;
  const modKey =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘" : "Ctrl";
  shortcutIconEl.innerHTML = modKey;
  shortcutIconEl.className = "shortcut-icon focus-hint";
};

const setupTextareaEvents = () => {
  const textarea = $(".note-input textarea");
  if (!textarea) return;
  const shortcutIconEl = $("#shortcutIcon");

  const updateHint = () => {
    if (!shortcutIconEl) return;
    const modKey =
      navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘" : "Ctrl";
    const hasText = textarea.value.trim();
    shortcutIconEl.innerHTML = hasText ? `${modKey}+↵` : modKey;
    shortcutIconEl.classList.toggle("focus-hint", !hasText);
    shortcutIconEl.classList.toggle("enter-hint", hasText);
  };

  textarea.addEventListener("focus", () => {
    updateHint();
    if (window.AnimationUtils) {
      window.AnimationUtils.updateStyles(textarea, { height: "50px" });
      requestAnimationFrame(() => {
        window.AnimationUtils.updateStyles(textarea, { height: "200px" });
      });
    } else {
      textarea.style.height = "50px";
      requestAnimationFrame(() => (textarea.style.height = "200px"));
    }
    textarea.addEventListener("input", updateHint);
  });
  textarea.addEventListener("blur", () => {
    updateShortcutIconDisplay();
    if (window.AnimationUtils) {
      window.AnimationUtils.updateStyles(textarea, { height: "200px" });
      requestAnimationFrame(() => {
        window.AnimationUtils.updateStyles(textarea, { height: "50px" });
      });
    } else {
      textarea.style.height = "200px";
      requestAnimationFrame(() => (textarea.style.height = "50px"));
    }
    textarea.removeEventListener("input", updateHint);
  });
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".note-input") && document.activeElement === textarea)
      textarea.blur();
  });
};

const safeParseJSON = (data, fallback = null) => {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to parse JSON data:", error);
    return fallback;
  }
};

const performOneTimeStorageCleanup = () => {
  const CLEANUP_FLAG_KEY = "stickyNotes_storageCleanupPerformed";

  // Check if cleanup has already been performed
  if (localStorage.getItem(CLEANUP_FLAG_KEY)) {
    return; // Cleanup already done, exit early
  }

  try {

    // Get all localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("stickyNotes_deleted") ||
          key.startsWith("stickyNotes_zIndexes") ||
          key.startsWith("boardColor_") ||
          key.startsWith("boardPattern_") ||
          key.startsWith("boardStyles_") ||
          key.startsWith("emojiStickers_") ||
          key.startsWith("daysPatternStartDate_") ||
          key.startsWith("emojiUsageOrder"))
      ) {
        keysToRemove.push(key);
      }
    }

    // Remove all old app data
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    // Set the flag to indicate cleanup has been performed
    localStorage.setItem(CLEANUP_FLAG_KEY, "true");
  } catch (error) {
    console.error("Error during localStorage cleanup:", error);
    // Still set the flag to prevent repeated attempts if there's an error
    localStorage.setItem(CLEANUP_FLAG_KEY, "true");
  }
};

const loadSavedData = () => {
  try {
    // Check if createNote function is available, if not, delay loading
    if (typeof createNote !== "function") {
      setTimeout(loadSavedData, 50);
      return;
    }
    
    // Flush any pending debounced saves before loading
    window.DebouncedStorage.flush();
    
    // Perform one-time localStorage cleanup before loading any data
    performOneTimeStorageCleanup();

    if (typeof createSelectionBox === "function") createSelectionBox();

    const savedBoardCount = localStorage.getItem(BOARDS_COUNT_KEY);
    
    if (savedBoardCount) {
      const parsedCount = parseInt(savedBoardCount);
      if (!isNaN(parsedCount) && parsedCount > 0) {
        // Trust the saved boardCount but cap it at MAX_BOARDS
        boardCount = Math.min(parsedCount, MAX_BOARDS);

        // Create UI for all boards up to the saved count
        for (let i = 2; i <= boardCount; i++) {
          if (typeof createBoardUI === "function") createBoardUI(i);
        }
      }
    }
    if (typeof updateAddButtonState === "function") updateAddButtonState();

    for (let i = 1; i <= boardCount; i++) {
      const savedBoardNotes = localStorage.getItem(
        `${ACTIVE_NOTES_KEY}_board_${i}`,
      );
      
      if (savedBoardNotes) {
        const notesData = safeParseJSON(savedBoardNotes, []);
        
        if (Array.isArray(notesData)) {
          notesData.forEach((note) => {
            if (note && typeof note === "object" && (note.text || note.content)) {
              lastNotePositions[i] = {
                x: parsePosition(note.x),
                y: parsePosition(note.y),
              };
              lastNoteColors[i] = note.color || colors[0];
              const noteText = note.text || note.content;
              const createdNote = createNote(
                noteText,
                note.color || colors[0],
                parsePosition(note.x),
                parsePosition(note.y),
                true,
                note.width || "200px",
                note.height || "150px",
                note.isBold || false,
                i,
              );
              if (createdNote && note.noteId) {
                createdNote.dataset.noteId = note.noteId;
                // Apply saved z-index from the z-index management system
                if (noteZIndexes[note.noteId]) {
                  if (window.AnimationUtils) {
                    window.AnimationUtils.updateStyles(createdNote, { zIndex: noteZIndexes[note.noteId].toString() });
                  } else {
                    createdNote.style.zIndex = noteZIndexes[note.noteId];
                  }
                  if (noteZIndexes[note.noteId] > globalZIndex) {
                    globalZIndex = noteZIndexes[note.noteId];
                  }
                } else if (note.zIndex && !isNaN(parseInt(note.zIndex))) {
                  if (window.AnimationUtils) {
                    window.AnimationUtils.updateStyles(createdNote, { zIndex: note.zIndex.toString() });
                  } else {
                    createdNote.style.zIndex = note.zIndex;
                  }
                  noteZIndexes[note.noteId] = parseInt(note.zIndex);
                  if (parseInt(note.zIndex) > globalZIndex) {
                    globalZIndex = parseInt(note.zIndex);
                  }
                }
              }
            }
          });
        }
      }
      if (typeof loadBoardStyles === "function") loadBoardStyles(i);
    }
    if (typeof switchToBoard === "function") switchToBoard(1);

    const savedDeleted = localStorage.getItem(DELETED_NOTES_KEY);
    if (savedDeleted) {
      const deletedData = safeParseJSON(savedDeleted, []);
      if (Array.isArray(deletedData)) {
        deletedNotes = deletedData;
        if (typeof updateTrashCount === "function") updateTrashCount();
      }
    }
    ["updateBoardIndicators", "updateShortcutHintVisibility"].forEach((fn) => {
      if (typeof window[fn] === "function") window[fn]();
    });
    updateShortcutIconDisplay();
    setupTextareaEvents();
  } catch (error) {
    console.error("Critical error loading saved data:", error);
  }
};

// Z-INDEX LAYERING SYSTEM

/**
 * Gets the next available z-index value
 * @returns {number} Next z-index value
 */
const getNextZIndex = () => ++globalZIndex;

/**
 * Brings a note to the front by assigning it the highest z-index
 * @param {Element} noteElement - The note element to bring to front
 */
const bringNoteToFront = (noteElement) => {
  if (window.AnimationUtils) {
    window.AnimationUtils.updateStyles(noteElement, { zIndex: getNextZIndex().toString() });
  } else {
    noteElement.style.zIndex = getNextZIndex();
  }
  const noteId = noteElement.dataset.noteId;
  if (noteId) ((noteZIndexes[noteId] = globalZIndex), saveNoteZIndexes());
};

/**
 * Saves note z-index data to localStorage
 */
const saveNoteZIndexes = () => {
  try {
    window.DebouncedStorage.saveLow(NOTE_ZINDEX_KEY, noteZIndexes);
  } catch (error) {
    console.error("Error saving note z-indexes:", error);
  }
};

/**
 * Loads note z-index data from localStorage
 */
const loadNoteZIndexes = () => {
  try {
    const saved = localStorage.getItem(NOTE_ZINDEX_KEY);
    if (saved)
      (Object.assign(noteZIndexes, JSON.parse(saved)),
        (globalZIndex = Math.max(1000, ...Object.values(noteZIndexes))));
  } catch (error) {
    console.error("Error loading note z-indexes:", error);
  }
};

/**
 * Applies saved z-index to a note element
 * @param {Element} noteElement - The note element to apply z-index to
 */
const applyNoteZIndex = (noteElement) => {
  const noteId = noteElement.dataset.noteId;
  if (noteId && noteZIndexes[noteId])
    if (window.AnimationUtils) {
      window.AnimationUtils.updateStyles(noteElement, { zIndex: noteZIndexes[noteId].toString() });
    } else {
      noteElement.style.zIndex = noteZIndexes[noteId];
    }
};
