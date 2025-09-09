// Style utilities
// DOM utilities
/**
 * BOARD MANAGEMENT MODULE
 * Handles multi-board functionality including:
 * - Board creation, deletion, and navigation
 * - Board styling (colors, patterns, themes)
 * - Pattern-based layouts (weekdays, days, dots, grid, lines)
 * - Board switching with keyboard shortcuts
 * - Title management and board indicators
 * - Days pattern tracking for scheduling workflows
 */

// UTILITY FUNCTIONS FOR DATE AND TIME MANAGEMENT

/**
 * Gets current date - can be overridden for testing
 * @returns {Date} Current date object
 */
const getCurrentDate = () => new Date();

/**
 * Checks if a given weekday index represents the current day
 * @param {number} weekdayIndex - Index where 0=Monday, 1=Tuesday, ..., 5=Saturday
 * @returns {boolean} True if the index matches today's weekday
 */
const isCurrentDay = (weekdayIndex) => {
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const today = getCurrentDate().getDay();
  // Convert to 0-based index where 0 = Monday, 1 = Tuesday, ..., 5 = Saturday
  const currentDayIndex = today === 0 ? 6 : today - 1;
  return weekdayIndex === currentDayIndex;
};

/**
 * Saves the start date for days pattern tracking
 * Only saves if no start date exists to preserve the original reference point
 * @param {number} boardId - The board ID to save the start date for
 */
const saveDaysPatternStartDate = (boardId) => {
  const key = `daysPatternStartDate_${boardId}`;
  if (!localStorage.getItem(key))
    localStorage.setItem(key, getCurrentDate().toISOString().split("T")[0]);
};

/**
 * Calculates which day number (0-4) it is in the 5-day cycle
 * @param {number} boardId - The board ID to check
 * @returns {number} Day number (0-4) or -1 if no start date set
 */
const getCurrentDayNumber = (boardId) => {
  const startDate = localStorage.getItem(`daysPatternStartDate_${boardId}`);
  if (!startDate) return -1;
  const diffDays = Math.floor(
    (getCurrentDate() - new Date(startDate)) / (1000 * 60 * 60 * 24),
  );
  return diffDays % 5;
};

/**
 * Removes days pattern data for a board
 * @param {number} boardId - The board ID to clean up
 */
const cleanupDaysPatternData = (boardId) =>
  localStorage.removeItem(`daysPatternStartDate_${boardId}`);

// BOARD CREATION AND MANAGEMENT

/**
 * Creates a new board with validation for limits
 * Handles UI creation, state saving, and button updates
 */
const createNewBoard = () => {
  if (boardCount >= MAX_BOARDS) {
    alert(`Maximum number of boards (${MAX_BOARDS}) reached.`);
    return;
  }
  createBoardUI(++boardCount);
  saveBoardCount();
  updateAddButtonState();
};

/**
 * Creates the complete UI structure for a new board
 * Includes board element, title input, navigation button, and event handlers
 * @param {number} boardId - The ID for the new board
 */
function createBoardUI(boardId) {
  const boardsContainer = $(".boards-container");
  const boardElement = Object.assign(document.createElement("div"), {
    className: "board",
  });
  boardElement.dataset.boardId = boardId;
  boardsContainer.appendChild(boardElement);

  const titleCircle = Object.assign(document.createElement("div"), {
    className: "board-title-circle",
  });
  
  // Store event handlers for cleanup
  const boardEventHandlers = [];
  
  const titleCircleClickHandler = () => {
    $within(titleCircle, '.board-title-input')?.focus();
  };
  titleCircle.addEventListener('click', titleCircleClickHandler);
  boardEventHandlers.push({ element: titleCircle, event: 'click', handler: titleCircleClickHandler });

  const titleInput = Object.assign(document.createElement("input"), {
    type: "text",
    className: "board-title-input",
    placeholder: "Title...",
    maxLength: 30,
  });

  let titleSaveTimeout;
  const saveTitleDebounced = () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.value = titleInput.dataset.originalTitle || "";
      return;
    }
    saveBoardTitle(boardId, title);
    updateCharCounter(titleInput);
  };
  
  const titleInputHandler = () => {
    clearTimeout(titleSaveTimeout);
    titleSaveTimeout = setTimeout(saveTitleDebounced, 500);
  };
  titleInput.addEventListener("input", titleInputHandler);
  boardEventHandlers.push({ element: titleInput, event: 'input', handler: titleInputHandler });
  [
    updateCharCounter(titleInput),
    titleCircle.appendChild(titleInput),
    boardElement.appendChild(titleCircle),
  ];

  const buttonElement = Object.assign(document.createElement("div"), {
    className: "board-button new-button",
    textContent: boardId,
  });
  buttonElement.dataset.boardId = boardId;
  
  const buttonClickHandler = () => switchToBoard(boardId);
  buttonElement.addEventListener("click", buttonClickHandler);
  boardEventHandlers.push({ element: buttonElement, event: 'click', handler: buttonClickHandler });

  if (boardId > 1) {
    const deleteButton = Object.assign(document.createElement("div"), {
      className: "delete-board",
      textContent: "×",
    });
    const deleteClickHandler = (e) => {
      e.stopPropagation();
      deleteBoard(boardId);
    };
    deleteButton.addEventListener("click", deleteClickHandler);
    boardEventHandlers.push({ element: deleteButton, event: 'click', handler: deleteClickHandler });
    buttonElement.appendChild(deleteButton);
  }
  
  // Store cleanup function on board element
  boardElement._eventCleanup = () => {
    boardEventHandlers.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    clearTimeout(titleSaveTimeout);
  };

  $(".boards-navigation")
    .insertBefore(buttonElement, $(".add-board-button"));
  setTimeout(
    () => [
      buttonElement.classList.remove("new-button"),
      buttonElement.classList.add("transitions-ready"),
    ],
    500,
  );
  [loadBoardStyles(boardId), loadBoardTitle(boardId)];
  if (window.emojiStickers) window.emojiStickers.loadEmojiStickers(boardId);
}

/**
 * Deletes a board with confirmation and cleanup
 * Handles note/sticker animations, data cleanup, and board renumbering
 * @param {number} boardId - The ID of the board to delete
 */
function deleteBoard(boardId) {
  if (!confirm(`Are you sure you want to delete board ${boardId}?`)) return;

  const boardElement = $(
    `.board[data-board-id="${boardId}"]`,
  );
  if (!boardElement) {
    continueWithBoardDeletion(boardId);
    return;
  }

  const [notes, stickers] = [
    Array.from(boardElement.querySelectorAll(".sticky-note")),
    Array.from(boardElement.querySelectorAll(".emoji-sticker")),
  ];

  if (notes.length || stickers.length) {
    const trashBin = $(".trash-bin");
    const trashRect = trashBin.getBoundingClientRect();
    trashBin.style.animation = "binShake 0.5s ease-in-out";

    notes.forEach((note) => {
      const content = $within(note, ".sticky-content");
      deletedNotes.unshift({
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: content.classList.contains("bold"),
      });

      const noteRect = note.getBoundingClientRect();
      const [throwX, throwY] = [
        trashRect.left -
          noteRect.left +
          trashRect.width / 2 -
          noteRect.width / 2,
        trashRect.top - noteRect.top,
      ];
      note.style.setProperty("--throwX", `${throwX}px`);
      note.style.setProperty("--throwY", `${throwY}px`);
      note.style.animation = "paperCrumble 0.5s ease-in forwards";
    });

    stickers.forEach((sticker) => sticker.classList.add("deleting"));
    window.DebouncedStorage.saveLow(DELETED_NOTES_KEY, deletedNotes);
    updateTrashCount();
    console.log('Setting timeout for continueWithBoardDeletion, boardId:', boardId);
    setTimeout(() => {
      console.log('Timeout fired, calling continueWithBoardDeletion');
      continueWithBoardDeletion(boardId);
    }, 600);
  } else {
    continueWithBoardDeletion(boardId);
  }
}

/**
 * Continues board deletion after animations complete
 * Handles DOM cleanup, data migration, and board renumbering
 * @param {number} boardId - The ID of the board being deleted
 */
function continueWithBoardDeletion(boardId) {
  console.log('continueWithBoardDeletion called with boardId:', boardId);
  const [boardElement, buttonElement] = [
    $(`.board[data-board-id="${boardId}"]`),
    $(`.board-button[data-board-id="${boardId}"]`),
  ];
  console.log('Found elements:', { boardElement, buttonElement });
  
  // Clean up event listeners before removing elements
  if (boardElement?._eventCleanup) {
    boardElement._eventCleanup();
  }
  
  if (boardElement) boardElement.remove();
  if (buttonElement) buttonElement.classList.add("removing");

  const buttonsToRenumber = [];
  for (let i = boardId + 1; i <= boardCount; i++) {
    const button = $(
      `.board-button[data-board-id="${i}"]`,
    );
    if (button) {
      button.classList.add("removing");
      buttonsToRenumber.push(i);
    }
  }

  // Remove board-related data
  [
    `${ACTIVE_NOTES_KEY}_board_${boardId}`,
    `stickyNotes_boardTitle_${boardId}`,
    `boardColor_${boardId}`,
    `boardPattern_${boardId}`,
    `boardStyles_board_${boardId}`,
  ].forEach((key) => localStorage.removeItem(key));
  cleanupDaysPatternData(boardId);
  if (window.emojiStickers) window.emojiStickers.cleanupEmojiStickers(boardId);

  // Shift style settings from next boards
  for (let i = boardId + 1; i <= boardCount; i++) {
    ["boardColor", "boardPattern", "boardStyles_board"].forEach((keyPrefix) => {
      const [oldKey, newKey, data] = [
        `${keyPrefix}_${i}`,
        `${keyPrefix}_${i - 1}`,
        localStorage.getItem(`${keyPrefix}_${i}`),
      ];
      if (data) localStorage.setItem(newKey, data);
      localStorage.removeItem(oldKey);
    });
  }

  setTimeout(() => {
    if (buttonElement) buttonElement.remove();
    const [navigationContainer, addButton] = [
      $(".boards-navigation"),
      $(".add-board-button"),
    ];

    buttonsToRenumber.forEach((oldId) => {
      const [oldButton, board, newId] = [
        $(`.board-button[data-board-id="${oldId}"]`),
        $(`.board[data-board-id="${oldId}"]`),
        oldId - 1,
      ];
      if (oldButton) oldButton.remove();
      if (board) board.dataset.boardId = newId;

      const newButton = Object.assign(document.createElement("div"), {
        className: "board-button new-button",
        textContent: newId,
      });
      [newButton.dataset.boardId, newButton.dataset.originalNumber] = [
        newId,
        newId,
      ];
      newButton.addEventListener("click", () => switchToBoard(newId));

      if (newId > 1) {
        const deleteBtn = Object.assign(document.createElement("div"), {
          className: "delete-board",
          textContent: "×",
        });
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteBoard(newId);
        });
        newButton.appendChild(deleteBtn);
      }
      navigationContainer.insertBefore(newButton, addButton);

      ["", "Title", "Color", "Pattern"].forEach((suffix) => {
        const [baseKey, oldStorageKey, newStorageKey] = [
          suffix ? `stickyNotes_board${suffix}` : ACTIVE_NOTES_KEY,
          `${suffix ? `stickyNotes_board${suffix}` : ACTIVE_NOTES_KEY}_board_${oldId}`,
          `${suffix ? `stickyNotes_board${suffix}` : ACTIVE_NOTES_KEY}_board_${newId}`,
        ];
        const data = localStorage.getItem(oldStorageKey);
        if (data) {
          localStorage.setItem(newStorageKey, data);
          localStorage.removeItem(oldStorageKey);
        }
      });
      loadBoardStyles(newId);
    });

    setTimeout(
      () =>
        $$(".board-button.new-button")
          .forEach((button) => [
            button.classList.remove("new-button"),
            button.classList.add("transitions-ready"),
          ]),
      500,
    );
    [boardCount--, saveBoardCount(), updateAddButtonState()];

    if (currentBoardId === boardId)
      switchToBoard(boardId > 1 ? boardId - 1 : boardCount >= 1 ? 1 : null);
    else if (currentBoardId > boardId) {
      currentBoardId--;
      switchToBoard(currentBoardId);
    }
    $(".trash-bin").style.animation = "";
  }, 350);
}

/**
 * Switches to a different board with smooth transitions
 * Handles board visibility, animations, and state management
 * @param {number} boardId - The target board ID to switch to
 */
function switchToBoard(boardId) {
  const targetBoardId = parseInt(boardId);
  if (targetBoardId === currentBoardId || targetBoardId === null) return;

  [
    showShortcutHintOnFirstSwitch(),
    document.body.classList.add("board-switching"),
  ];
  setTimeout(() => document.body.classList.remove("board-switching"), 300);
  currentBoardId = targetBoardId;

  if (!lastNotePositions[boardId])
    lastNotePositions[boardId] = {
      x: window.innerWidth / 2 - 100,
      y: window.innerHeight / 2 - 75,
    };
  if (!lastNoteColors[boardId]) lastNoteColors[boardId] = colors[0];

  $$(".board").forEach((board) => {
    const id = parseInt(board.dataset.boardId);
    [
      board.classList.remove("active", "prev", "next"),
      (board.style.visibility = "hidden"),
    ];

    if (id === currentBoardId) {
      [board.classList.add("active"), (board.style.visibility = "visible")];
      Array.from(board.querySelectorAll(".sticky-note"))
        .forEach((note, index) =>
          note.style.setProperty("--note-index", index),
        );
      Array.from(board.querySelectorAll(".emoji-sticker"))
        .forEach((sticker, index) =>
          sticker.style.setProperty("--sticker-index", index),
        );

      if (!$within(board, ".board-title-circle")) {
        const titleCircle = Object.assign(document.createElement("div"), {
          className: "board-title-circle",
        });
        titleCircle.setAttribute(
          "onclick",
          "$within(this, '.board-title-input').focus()",
        );
        const titleInput = Object.assign(document.createElement("input"), {
          type: "text",
          className: "board-title-input",
          placeholder: "Title...",
          maxLength: 30,
        });
        const saveHandler = () => saveBoardTitle(id, titleInput.value);
        ["change", "blur"].forEach((event) =>
          titleInput.addEventListener(event, saveHandler),
        );
        [
          titleCircle.appendChild(titleInput),
          board.appendChild(titleCircle),
          loadBoardTitle(id),
        ];
      }
    } else board.classList.add(id < currentBoardId ? "prev" : "next");
  });

  $$(".board-button")
    .forEach((button) =>
      button.classList.toggle(
        "active",
        parseInt(button.dataset.boardId) === currentBoardId,
      ),
    );
  [loadBoardStyles(currentBoardId), setActiveStyle()];
  $$(".board-pattern-option, .pattern-preview")
    .forEach((el) => (el.style.backgroundColor = boardStyles.colors.current));
  updateBoardIndicators();
  if (window.emojiStickers)
    window.emojiStickers.renderEmojiStickers(currentBoardId);
  setTimeout(() => showBoardTitleTemporarily(currentBoardId), 300);
}

// Global navigation event handlers storage
let globalNavigationHandlers = [];

/**
 * Sets up all board navigation functionality
 * Includes keyboard shortcuts and button handlers
 */
function setupBoardNavigation() {
  // Clean up existing global handlers first
  cleanupGlobalNavigationHandlers();
  
  const addBoardClickHandler = createNewBoard;
  $(".add-board-button").addEventListener("click", addBoardClickHandler);
  globalNavigationHandlers.push({ 
    element: $(".add-board-button"), 
    event: "click", 
    handler: addBoardClickHandler 
  });
  
  $$(".board-button").forEach((button) => {
    const [boardId, newButton] = [
      parseInt(button.dataset.boardId),
      button.cloneNode(true),
    ];
    const buttonClickHandler = () => switchToBoard(boardId);
    newButton.addEventListener("click", buttonClickHandler);
    
    const deleteButton = $within(newButton, ".delete-board");
    if (deleteButton) {
      const deleteClickHandler = (e) => {
        e.stopPropagation();
        deleteBoard(boardId);
      };
      deleteButton.addEventListener("click", deleteClickHandler);
    }
    button.parentNode.replaceChild(newButton, button);
  });

  const documentKeydownHandler = (e) => {
    const [targetTagName, isEditable] = [
      e.target.tagName,
      e.target.getAttribute("contenteditable") === "true",
    ];

    if (
      (e.key === "Control" || e.key === "Meta") &&
      !e.altKey &&
      !e.shiftKey &&
      targetTagName !== "TEXTAREA" &&
      !isEditable
    ) {
      e.preventDefault();
      $(".note-input textarea").focus();
      return;
    }
    if (targetTagName === "TEXTAREA" || isEditable) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        addNote();
      }
      return;
    }
    if (e.key === "ArrowLeft" && currentBoardId > 1)
      switchToBoard(currentBoardId - 1);
    else if (e.key === "ArrowRight" && currentBoardId < boardCount)
      switchToBoard(currentBoardId + 1);
    else if (e.key === "n" && e.ctrlKey) {
      e.preventDefault();
      createNewBoard();
    } else if (e.key === "d" && e.ctrlKey && currentBoardId > 1) {
      e.preventDefault();
      deleteBoard(currentBoardId);
    }
    const keyNum = parseInt(e.key);
    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9 && keyNum <= boardCount)
      switchToBoard(keyNum);
  };
  
  // Register keyboard navigation
  document.addEventListener('keydown', documentKeydownHandler);
  globalNavigationHandlers.push({ 
    element: document, 
    event: "keydown", 
    handler: documentKeydownHandler 
  });
}

/**
 * Cleans up global navigation event handlers
 */
function cleanupGlobalNavigationHandlers() {
  globalNavigationHandlers.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  globalNavigationHandlers = [];
}

/**
 * Updates the add board button state based on current limits
 * Handles disabled state and tooltip updates
 */
function updateAddButtonState() {
  const addButton = $(".add-board-button");
  const disabled = boardCount >= MAX_BOARDS;
  addButton.classList.toggle("disabled", disabled);
  addButton.title = disabled
    ? `Maximum number of boards (${MAX_BOARDS}) reached`
    : "Add new board";
  updateShortcutHintVisibility();
}

/**
 * Shows or hides the keyboard shortcut hint based on board count
 */
function updateShortcutHintVisibility() {
  const shortcutHint = $(".shortcut-hint");
  if (shortcutHint)
    shortcutHint.style.display = boardCount >= 2 ? "block" : "none";
}

// SHORTCUT HINT MANAGEMENT
let hasShownHint = false;

/**
 * Shows the shortcut hint automatically on first board switch
 * Only shows once per session when multiple boards exist
 */
function showShortcutHintOnFirstSwitch() {
  // Skip if we've already shown the hint or there's only one board
  if (hasShownHint || boardCount < 2) return;

  const shortcutHint = $(".shortcut-hint");
  if (!shortcutHint) return;

  // Mark that we've shown the hint
  hasShownHint = true;

  // Show hint for 4 seconds
  shortcutHint.classList.add("auto-show");
  setTimeout(() => {
    shortcutHint.classList.remove("auto-show");
  }, 4000);
}

// BOARD STYLING AND PATTERNS

/**
 * Toggles the board style menu visibility with smooth animations
 */
function toggleBoardStyleMenu() {
  const styleMenu = $(".board-style-menu");
  const isVisible = styleMenu.classList.contains("visible");
  if (!isVisible) {
    setActiveStyle();
    setupStyleOptions();
    document
      .querySelectorAll(".board-pattern-option, .pattern-preview")
      .forEach((el) => (el.style.backgroundColor = boardStyles.colors.current));
    void styleMenu.offsetWidth; // Reflow
  }
  styleMenu.classList.toggle("visible", !isVisible);
  styleMenu.classList.toggle("closing", isVisible);
  if (isVisible) setTimeout(() => styleMenu.classList.remove("closing"), 300);
}

/**
 * Sets up event handlers for board style options (colors and patterns)
 * Prevents duplicate initialization with 'initialized' class tracking
 */
function setupStyleOptions() {
  if ($(".board-color-option.initialized")) return;
  document
    .querySelectorAll(".board-color-option, .board-pattern-option")
    .forEach((option) => {
      option.classList.add("initialized");
      const type = option.classList.contains("board-color-option")
        ? "color"
        : "pattern";
      const value = option.getAttribute(`data-${type}`);
      option.addEventListener("click", () => {
        if (type === "color") changeBoardColor(value);
        else changeBoardPattern(value);
        document
          .querySelectorAll(`.board-${type}-option`)
          .forEach((opt) => opt.classList.remove("active"));
        option.classList.add("active");
      });
    });
}

/**
 * Updates the UI to show which color and pattern are currently active
 */
function setActiveStyle() {
  ["color", "pattern"].forEach((type) => {
    $$(`.board-${type}-option`).forEach((option) => {
      option.classList.toggle(
        "active",
        option.getAttribute(`data-${type}`) === boardStyles[`${type}s`].current,
      );
    });
  });
}

/**
 * Gets the currently active board element
 * @returns {Element} The active board element
 */
function getActiveBoard() {
  return $('.board.active');
}

/**
 * Changes the background color of the current board
 * @param {string} color - The new color value to apply
 */
function changeBoardColor(color) {
  boardStyles.colors.current = color;
  const activeBoard = getActiveBoard();
  activeBoard.style.backgroundColor = color;
  document
    .querySelectorAll(".pattern-preview, .board-pattern-option")
    .forEach((el) => {
      el.style.backgroundColor = color;
      if (el.classList.contains("board-pattern-option"))
        el.style.opacity = "0.8";
    });
  saveBoardStyles();
  updateBoardIndicators();
  activeBoard.style.transition = "background-color 0.5s ease";
  setTimeout(() => (activeBoard.style.transition = ""), 500);
}

/**
 * Creates pattern overlay elements for board backgrounds
 * Handles dots, grid, lines, weekdays, and days patterns
 * @param {string} pattern - The pattern type to create
 * @returns {Element} The created overlay element
 */
function createPatternOverlay(pattern) {
  const overlay = Object.assign(document.createElement("div"), {
    style:
      "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1; transition:opacity 0.3s ease-out; opacity:0;",
  });
  const board = $(
    `.board[data-board-id="${currentBoardId}"]`,
  );

  if (pattern !== "none") {
    const patterns = {
      dots: "background-image:radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px); background-size:20px 20px;",
      grid: "background-image:linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px); background-size:20px 20px;",
      lines:
        "background-image:linear-gradient(0deg, transparent 19px, rgba(255,255,255,0.4) 20px); background-size:20px 20px;",
    };
    if (patterns[pattern]) overlay.style.cssText += patterns[pattern];
    else if (pattern === "weekdays" || pattern === "days") {
      const header = Object.assign(document.createElement("div"), {
        className: pattern === "weekdays" ? "weekday-header" : "day-header",
      });
      const items =
        pattern === "weekdays"
          ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          : ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
      items.forEach((item, index) => {
        const span = Object.assign(document.createElement("span"), {
          textContent: item,
        });
        if (
          (pattern === "weekdays" && isCurrentDay(index)) ||
          (pattern === "days" && getCurrentDayNumber(currentBoardId) === index)
        ) {
          span.classList.add("current-day");
        }
        header.appendChild(span);
      });
      [overlay.appendChild(header), board?.classList.add("has-header")];
    }
  } else board?.classList.remove("has-header");
  return overlay;
}

/**
 * Changes the pattern overlay for the current board
 * Handles pattern transitions and days pattern initialization
 * @param {string} pattern - The new pattern to apply
 */
function changeBoardPattern(pattern) {
  const [activeBoard, boardId, currentPattern] = [
    getActiveBoard(),
    getActiveBoard().dataset.boardId,
    boardStyles.patterns.current,
  ];

  if (currentPattern === "days" && pattern !== "days")
    cleanupDaysPatternData(boardId);
  boardStyles.patterns.current = pattern;

  // Remove all existing pattern overlays and classes
  activeBoard
    .querySelectorAll(".pattern-overlay, .lines-overlay, .weekday-header, .day-header")
    .forEach((el) => el.remove());
  activeBoard.classList.remove(
    "board-pattern-dots",
    "board-pattern-grid",
    "board-pattern-lines",
    "board-pattern-weekdays",
    "board-pattern-days",
  );
  
  // More aggressive cleanup - remove all overlay divs
  Array.from(activeBoard.children).forEach((child) => {
    if (child.tagName === 'DIV' && 
        child.style.position === 'absolute' && 
        child.style.pointerEvents === 'none' &&
        (child.style.zIndex === '0' || child.style.zIndex === '1' || 
         child.style.top === '0px' || child.style.left === '0px')) {
      child.remove();
    }
  });

  if (pattern === "days") saveDaysPatternStartDate(boardId);

  const patternOverlay = createPatternOverlay(pattern);
  activeBoard.appendChild(patternOverlay);

  let linesOverlay = null;
  if (pattern === "weekdays" || pattern === "days") {
    linesOverlay = Object.assign(document.createElement("div"), {
      className: `lines-overlay lines-overlay-${pattern}`,
      style:
        "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0; opacity:0; transition:opacity 0.3s ease;",
    });
    activeBoard.appendChild(linesOverlay);
  }

  // Force reflow before starting transitions
  void patternOverlay.offsetWidth;
  
  // Start transitions smoothly
  requestAnimationFrame(() => {
    patternOverlay.style.opacity = "1";
    if (linesOverlay) linesOverlay.style.opacity = "1";
  });

  // Wait for transition to complete before making any changes
  patternOverlay.addEventListener('transitionend', () => {
    if (pattern === "weekdays" || pattern === "days") {
      activeBoard.classList.add(`board-pattern-${pattern}`);
      patternOverlay.classList.add("pattern-overlay");
      if (linesOverlay) {
        linesOverlay.classList.add("pattern-overlay");
      }
    } else {
      if (pattern !== "none")
        activeBoard.classList.add(`board-pattern-${pattern}`);
    }
    updateBoardIndicators();
  }, { once: true });
  saveBoardStyles();
}

/**
 * Applies saved styles to a board element
 * @param {Element} board - The board element to style
 * @param {Object} styles - Style object with color and pattern properties
 */
function applyBoardSavedStyles(board, styles) {
  board.style.backgroundColor = styles.color;
  board
    .querySelectorAll(".pattern-overlay, .lines-overlay")
    .forEach((el) => el.remove());
  board.classList.remove(
    "board-pattern-dots",
    "board-pattern-grid",
    "board-pattern-lines",
    "board-pattern-weekdays",
    "board-pattern-days",
  );

  if (styles.pattern !== "none") {
    board.classList.add(`board-pattern-${styles.pattern}`);
    if (styles.pattern === "weekdays" || styles.pattern === "days") {
      const headerOverlay = Object.assign(document.createElement("div"), {
        className: `pattern-overlay ${styles.pattern === "weekdays" ? "weekday-header" : "day-header"}`,
      });
      const items =
        styles.pattern === "weekdays"
          ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          : Array.from({ length: 5 }, (_, i) => `Day ${i + 1}`);
      items.forEach((item, index) => {
        const span = Object.assign(document.createElement("span"), {
          textContent: item,
        });
        if (
          (styles.pattern === "weekdays" && isCurrentDay(index)) ||
          (styles.pattern === "days" &&
            getCurrentDayNumber(parseInt(board.dataset.boardId)) === index)
        ) {
          span.classList.add("current-day");
        }
        headerOverlay.appendChild(span);
      });
      board.appendChild(headerOverlay);

      const linesOverlay = Object.assign(document.createElement("div"), {
        className: `pattern-overlay lines-overlay lines-overlay-${styles.pattern}`,
        style:
          "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;",
      });
      board.appendChild(linesOverlay);
    }
  }
}

/**
 * Loads and applies saved styles for a specific board
 * Falls back to default styles if no saved styles exist
 * @param {number} boardId - The board ID to load styles for
 */
function loadBoardStyles(boardId) {
  const savedStyles = localStorage.getItem(`boardStyles_board_${boardId}`);
  const board = $(`.board[data-board-id="${boardId}"]`);
  if (!board) return;

  let stylesToApply;
  if (savedStyles) {
    stylesToApply = JSON.parse(savedStyles);
    if (boardId === currentBoardId) {
      boardStyles.colors.current = stylesToApply.color;
      boardStyles.patterns.current = stylesToApply.pattern;
    }
  } else {
    stylesToApply = {
      color: boardStyles.colors.default,
      pattern: boardStyles.patterns.default,
    };
    if (boardId === currentBoardId) {
      boardStyles.colors.current = stylesToApply.color;
      boardStyles.patterns.current = stylesToApply.pattern;
    }
  }
  applyBoardSavedStyles(board, stylesToApply);
  updateBoardIndicators();
}

// BOARD TITLE MANAGEMENT

/**
 * Initialize board titles and setup click-outside handler for style menu
 */
loadAllBoardTitles();
document.addEventListener("click", function (event) {
  const styleMenu = $(".board-style-menu");
  const styleButton = $(".board-style-button");
  if (
    styleMenu &&
    styleMenu.classList.contains("visible") &&
    styleButton &&
    !styleButton.contains(event.target) &&
    !styleMenu.contains(event.target)
  ) {
    styleMenu.classList.add("closing");
    styleMenu.classList.remove("visible");
    setTimeout(() => styleMenu.classList.remove("closing"), 300);
  }
});
document
  .querySelector(".board-style-menu")
  .addEventListener("click", (event) => event.stopPropagation());

/**
 * Loads titles for all existing boards from localStorage
 */
function loadAllBoardTitles() {
  document
    .querySelectorAll(".board")
    .forEach((board) => loadBoardTitle(board.dataset.boardId));
}

/**
 * Saves a board title to localStorage and updates button metadata
 * @param {number} boardId - The board ID
 * @param {string} title - The title to save
 */
function saveBoardTitle(boardId, title) {
  localStorage.setItem(`stickyNotes_boardTitle_${boardId}`, title);
  const buttonElement = $(`.board-button[data-board-id="${boardId}"]`);
  if (buttonElement && !buttonElement.dataset.originalNumber) {
    buttonElement.dataset.originalNumber = buttonElement.textContent;
  }
}

/**
 * Updates the character counter display for title inputs
 * @param {Element} input - The input element to update counter for
 */
function updateCharCounter(input) {
  input.setAttribute(
    "data-counter",
    `${input.value.length}/${input.maxLength}`,
  );
}

/**
 * Loads and displays a saved board title
 * @param {number} boardId - The board ID to load title for
 */
function loadBoardTitle(boardId) {
  const title = localStorage.getItem(`stickyNotes_boardTitle_${boardId}`);
  const boardElement = $(`.board[data-board-id="${boardId}"]`);
  if (boardElement) {
    const titleInput = boardElement.querySelector(".board-title-input");
    if (titleInput && title) titleInput.value = title;
  }
  const buttonElement = $(`.board-button[data-board-id="${boardId}"]`);
  if (buttonElement && !buttonElement.dataset.originalNumber) {
    buttonElement.dataset.originalNumber = buttonElement.textContent;
  }
}

/**
 * Shows the board title circle temporarily for user feedback
 * @param {number} boardId - The board ID to show title for
 */
function showBoardTitleTemporarily(boardId) {
  const titleCircle = $(
    `.board[data-board-id="${boardId}"] .board-title-circle`,
  );
  if (titleCircle) {
    titleCircle.classList.add("show-temporary");
    setTimeout(() => titleCircle.classList.remove("show-temporary"), 3000);
  }
}

/**
 * Sets up hover and interaction handlers for board title circles
 * Includes delayed close functionality and auto-save on input
 */
function setupBoardTitleListeners() {
  $$(".board-title-circle").forEach((circle) => {
    let hoverTimeout;
    const [input, boardId] = [
      circle.querySelector(".board-title-input"),
      circle.closest(".board").dataset.boardId,
    ];

    ["mouseenter", "mouseleave", "click"].forEach((event, i) => {
      circle.addEventListener(event, () => {
        if (i === 0) {
          if (input) input.focus();
          clearTimeout(hoverTimeout);
          circle.classList.add("delayed-close");
        } else if (i === 1) {
          hoverTimeout = setTimeout(
            () => circle.classList.remove("delayed-close"),
            2000,
          );
          if (input) input.blur();
        } else if (input) input.focus();
      });
    });

    if (input) {
      let titleSaveTimeout;
      const saveTitleDebounced = () => {
        const title = input.value.trim();
        if (!title) {
          input.dataset.originalTitle = "";
          return;
        }
        [saveBoardTitle(boardId, title), updateCharCounter(input)];
      };
      input.addEventListener("input", () => {
        clearTimeout(titleSaveTimeout);
        titleSaveTimeout = setTimeout(saveTitleDebounced, 500);
      });
      updateCharCounter(input);
    }
  });
}

/**
 * Updates visual indicators on board navigation buttons
 * Shows note count, colors, patterns, and text contrast
 */
const updateBoardIndicators = () => {
  for (let i = 1; i <= boardCount; i++) {
    const [boardElement, buttonElement] = [
      $(`.board[data-board-id="${i}"]`),
      $(`.board-button[data-board-id="${i}"]`),
    ];
    if (!boardElement || !buttonElement) continue;

    const boardColor =
      boardElement.style.backgroundColor || boardStyles.colors.default;
    [
      buttonElement.classList.toggle(
        "has-notes",
        boardElement.querySelectorAll(".sticky-note").length > 0,
      ),
      (buttonElement.style.backgroundColor = boardColor),
    ];

    const patternClasses = [
      "board-pattern-dots",
      "board-pattern-grid",
      "board-pattern-lines",
      "board-pattern-weekdays",
      "board-pattern-days",
    ];
    const currentPatternClass = patternClasses.find((pc) =>
      boardElement.classList.contains(pc),
    );
    patternClasses.forEach((pc) =>
      buttonElement.classList.remove(
        pc.replace("board-pattern", "button-pattern"),
      ),
    );
    if (currentPatternClass)
      buttonElement.classList.add(
        currentPatternClass.replace("board-pattern", "button-pattern"),
      );

    const rgb = hexToRgb(boardColor) || { r: 26, g: 26, b: 26 };
    buttonElement.style.color =
      (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? "#000" : "#fff";
  }
};
