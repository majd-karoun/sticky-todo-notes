// Global variable to store test date override
// Helper function to get current date
function getCurrentDate() {
    return new Date();
}

// Helper function to check if a weekday index matches the current day
function isCurrentDay(weekdayIndex) {
    const today = getCurrentDate().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert Sunday (0) to be index 6, and shift Monday-Saturday to be 0-5
    const currentDayIndex = today === 0 ? 5 : today - 1; // Monday=0, Tuesday=1, ..., Saturday=5
    return weekdayIndex === currentDayIndex;
}

// Helper function to save the start date when days pattern is first applied
function saveDaysPatternStartDate(boardId) {
    const key = `daysPatternStartDate_${boardId}`;
    if (!localStorage.getItem(key)) {
        const today = getCurrentDate().toISOString().split('T')[0]; // YYYY-MM-DD format
        localStorage.setItem(key, today);
    }
}

// Helper function to calculate current day number based on start date
function getCurrentDayNumber(boardId) {
    const key = `daysPatternStartDate_${boardId}`;
    const startDate = localStorage.getItem(key);
    if (!startDate) return -1;
    
    const start = new Date(startDate);
    const today = getCurrentDate();
    const diffTime = today - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Return day number (0-4 for Day 1-5), cycling every 5 days
    return diffDays % 5;
}

// Helper function to clean up days pattern data
function cleanupDaysPatternData(boardId) {
    localStorage.removeItem(`daysPatternStartDate_${boardId}`);
}

// Board Management Functions
function createNewBoard() {
    if (isMobileView || boardCount >= MAX_BOARDS) {
        if (boardCount >= MAX_BOARDS) alert(`Maximum number of boards (${MAX_BOARDS}) reached.`);
        return;
    }
    boardCount++;
    createBoardUI(boardCount);
    saveBoardCount();
    updateAddButtonState();
}

function createBoardUI(boardId) {
    const boardsContainer = document.querySelector('.boards-container');
    const boardElement = document.createElement('div');
    boardElement.className = 'board';
    boardElement.dataset.boardId = boardId;
    boardsContainer.appendChild(boardElement);

    const titleCircle = document.createElement('div');
    titleCircle.className = 'board-title-circle';
    titleCircle.setAttribute('onclick', "this.querySelector('.board-title-input').focus()");

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'board-title-input';
    titleInput.placeholder = 'Title...';
    titleInput.maxLength = 30;

    let titleSaveTimeout;
    const saveTitleDebounced = () => {
        const title = titleInput.value.trim();
        if (title.length === 0) {
            titleInput.value = titleInput.dataset.originalTitle || '';
            return;
        }
        saveBoardTitle(boardId, title);
        updateCharCounter(titleInput);
    };
    titleInput.addEventListener('input', () => {
        clearTimeout(titleSaveTimeout);
        titleSaveTimeout = setTimeout(saveTitleDebounced, 500);
    });
    updateCharCounter(titleInput);
    titleCircle.appendChild(titleInput);
    boardElement.appendChild(titleCircle);

    const buttonElement = document.createElement('div');
    buttonElement.className = 'board-button new-button';
    buttonElement.dataset.boardId = boardId;
    buttonElement.textContent = boardId;
    buttonElement.addEventListener('click', () => switchToBoard(boardId));

    if (boardId > 1) {
        const deleteButton = document.createElement('div');
        deleteButton.className = 'delete-board';
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBoard(boardId);
        });
        buttonElement.appendChild(deleteButton);
    }

    const addButton = document.querySelector('.add-board-button');
    document.querySelector('.boards-navigation').insertBefore(buttonElement, addButton);

    setTimeout(() => buttonElement.classList.remove('new-button'), 500);
    loadBoardStyles(boardId);
    loadBoardTitle(boardId);
    
    // Load emoji stickers for the new board
    if (window.emojiStickers) {
        window.emojiStickers.loadEmojiStickers(boardId);
    }
}

function deleteBoard(boardId) {
    if (!confirm(`Are you sure you want to delete board ${boardId}?`)) return;

    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!boardElement) {
        continueWithBoardDeletion(boardId);
        return;
    }

    const notes = boardElement.querySelectorAll('.sticky-note');
    if (notes.length > 0) {
        const trashBin = document.querySelector('.trash-bin');
        const trashRect = trashBin.getBoundingClientRect();
        trashBin.style.animation = 'binShake 0.5s ease-in-out';

        notes.forEach(note => {
            const content = note.querySelector('.sticky-content');
            const noteData = {
                text: content.innerHTML,
                color: note.style.backgroundColor,
                x: note.style.left,
                y: note.style.top,
                width: note.style.width,
                height: note.style.height,
                timestamp: new Date().toLocaleString(),
                isBold: content.classList.contains('bold')
            };
            deletedNotes.unshift(noteData);

            const noteRect = note.getBoundingClientRect();
            const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
            const throwY = trashRect.top - noteRect.top;
            note.style.setProperty('--throwX', `${throwX}px`);
            note.style.setProperty('--throwY', `${throwY}px`);
            note.style.animation = 'paperCrumble 0.5s ease-in forwards';
        });
        saveDeletedNotes();
        updateTrashCount();
        setTimeout(() => continueWithBoardDeletion(boardId), 600);
    } else {
        continueWithBoardDeletion(boardId);
    }
}

function continueWithBoardDeletion(boardId) {
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (boardElement) boardElement.remove();

    const buttonElement = document.querySelector(`.board-button[data-board-id="${boardId}"]`);
    if (buttonElement) buttonElement.classList.add('removing');

    const buttonsToRenumber = [];
    for (let i = boardId + 1; i <= boardCount; i++) {
        const button = document.querySelector(`.board-button[data-board-id="${i}"]`);
        if (button) {
            button.classList.add('removing');
            buttonsToRenumber.push(i);
        }
    }

    // Remove all board-related data from localStorage
    localStorage.removeItem(`${ACTIVE_NOTES_KEY}_board_${boardId}`);
    localStorage.removeItem(`stickyNotes_boardTitle_${boardId}`);
    localStorage.removeItem(`boardColor_${boardId}`);
    localStorage.removeItem(`boardPattern_${boardId}`);
    localStorage.removeItem(`boardStyles_board_${boardId}`);
    cleanupDaysPatternData(boardId);
    
    // Clean up emoji stickers
    if (window.emojiStickers) {
        window.emojiStickers.cleanupEmojiStickers(boardId);
    }

    // Shift style settings from next boards
    for (let i = boardId + 1; i <= boardCount; i++) {
        ['boardColor', 'boardPattern', 'boardStyles_board'].forEach(keyPrefix => {
            const oldKey = `${keyPrefix}_${i}`;
            const newKey = `${keyPrefix}_${i-1}`;
            const data = localStorage.getItem(oldKey);
            if (data) {
                localStorage.setItem(newKey, data);
            }
            localStorage.removeItem(oldKey);
        });
    }

    setTimeout(() => {
        if (buttonElement) buttonElement.remove();

        buttonsToRenumber.forEach((oldId) => {
            const oldButton = document.querySelector(`.board-button[data-board-id="${oldId}"]`);
            if (oldButton) oldButton.remove();

            const board = document.querySelector(`.board[data-board-id="${oldId}"]`);
            const newId = oldId - 1;
            if (board) board.dataset.boardId = newId;

            const navigationContainer = document.querySelector('.boards-navigation');
            const addButton = document.querySelector('.add-board-button');
            const newButton = document.createElement('div');
            newButton.className = 'board-button new-button';
            newButton.dataset.boardId = newId;
            newButton.textContent = newId;
            newButton.dataset.originalNumber = newId;
            newButton.addEventListener('click', () => switchToBoard(newId));

            if (newId > 1) {
                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'delete-board';
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteBoard(newId); });
                newButton.appendChild(deleteBtn);
            }
            navigationContainer.insertBefore(newButton, addButton);

            ['', 'Title', 'Color', 'Pattern'].forEach(suffix => {
                const baseKey = suffix ? `stickyNotes_board${suffix}` : ACTIVE_NOTES_KEY;
                const oldStorageKey = `${baseKey}_board_${oldId}`;
                const newStorageKey = `${baseKey}_board_${newId}`;
                const data = localStorage.getItem(oldStorageKey);
                if (data) {
                    localStorage.setItem(newStorageKey, data);
                    localStorage.removeItem(oldStorageKey);
                }
            });
            loadBoardStyles(newId);
        });

        setTimeout(() => {
            document.querySelectorAll('.board-button.new-button').forEach(button => button.classList.remove('new-button'));
        }, 500);

        boardCount--;
        saveBoardCount();
        updateAddButtonState();

        if (currentBoardId === boardId) {
            switchToBoard(boardId > 1 ? boardId - 1 : (boardCount >= 1 ? 1 : null));
        } else if (currentBoardId > boardId) {
            currentBoardId--;
            switchToBoard(currentBoardId);
        }
        document.querySelector('.trash-bin').style.animation = '';
    }, 350);
}

function switchToBoard(boardId) {
    if (isMobileView && boardId !== 1) return;
    const targetBoardId = parseInt(boardId);
    if (targetBoardId === currentBoardId || targetBoardId === null) return;

    const previousBoardId = currentBoardId;
    currentBoardId = targetBoardId;

    if (!lastNotePositions[boardId]) lastNotePositions[boardId] = { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 75 };
    if (!lastNoteColors[boardId]) lastNoteColors[boardId] = colors[0];

    document.querySelectorAll('.board').forEach(board => {
        const id = parseInt(board.dataset.boardId);
        board.classList.remove('active', 'prev', 'next');
        board.style.visibility = 'hidden'; // Default to hidden

        if (id === currentBoardId) {
            board.classList.add('active');
            board.style.visibility = 'visible';
            board.querySelectorAll('.sticky-note').forEach((note, index) => note.style.setProperty('--note-index', index));
            board.querySelectorAll('.emoji-sticker').forEach((sticker, index) => sticker.style.setProperty('--sticker-index', index));

            if (!board.querySelector('.board-title-circle')) {
                const titleCircle = document.createElement('div');
                titleCircle.className = 'board-title-circle';
                titleCircle.setAttribute('onclick', "this.querySelector('.board-title-input').focus()");
                const titleInput = document.createElement('input');
                titleInput.type = 'text';
                titleInput.className = 'board-title-input';
                titleInput.placeholder = 'Title...';
                titleInput.maxLength = 30;
                const saveHandler = () => saveBoardTitle(id, titleInput.value);
                titleInput.addEventListener('change', saveHandler);
                titleInput.addEventListener('blur', saveHandler);
                titleCircle.appendChild(titleInput);
                board.appendChild(titleCircle);
                loadBoardTitle(id);
            }
        } else if (id < currentBoardId) {
            board.classList.add('prev');
        } else {
            board.classList.add('next');
        }
        // Visibility for prev/next is handled by CSS transitions ending
    });

    document.querySelectorAll('.board-button').forEach(button => {
        button.classList.toggle('active', parseInt(button.dataset.boardId) === currentBoardId);
    });

    loadBoardStyles(currentBoardId);
    setActiveStyle();
    document.querySelectorAll('.board-pattern-option, .pattern-preview').forEach(el => el.style.backgroundColor = boardStyles.colors.current);
    updateBoardIndicators();
    
    // Load emoji stickers for the current board
    if (window.emojiStickers) {
        window.emojiStickers.renderEmojiStickers(currentBoardId);
    }
    
    setTimeout(() => showBoardTitleTemporarily(currentBoardId), 300);
}

function setupBoardNavigation() {
    document.querySelector('.add-board-button').addEventListener('click', createNewBoard);
    document.querySelectorAll('.board-button').forEach(button => {
        const boardId = parseInt(button.dataset.boardId);
        const newButton = button.cloneNode(true);
        newButton.addEventListener('click', () => switchToBoard(boardId));
        const deleteButton = newButton.querySelector('.delete-board');
        if (deleteButton) {
            deleteButton.addEventListener('click', (e) => { e.stopPropagation(); deleteBoard(boardId); });
        }
        button.parentNode.replaceChild(newButton, button);
    });

    let startX, startY;
    const boardsContainer = document.querySelector('.boards-container');
    boardsContainer.addEventListener('touchstart', (e) => {
        if (isMobileView) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    boardsContainer.addEventListener('touchend', (e) => {
        if (isMobileView || !startX) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = startX - endX;
        if (Math.abs(diffX) > Math.abs(startY - endY) && Math.abs(diffX) > 50) {
            if (diffX > 0 && currentBoardId < boardCount) switchToBoard(currentBoardId + 1);
            else if (diffX < 0 && currentBoardId > 1) switchToBoard(currentBoardId - 1);
        }
        startX = null;
    });

    document.addEventListener('keydown', (e) => {
        if (isMobileView) return;
        const targetTagName = e.target.tagName;
        const isEditable = e.target.getAttribute('contenteditable') === 'true';

        if ((e.key === 'Control' || e.key === 'Meta') && !e.altKey && !e.shiftKey && targetTagName !== 'TEXTAREA' && !isEditable) {
            e.preventDefault();
            document.querySelector('.note-input textarea').focus();
            return;
        }
        if (targetTagName === 'TEXTAREA' || isEditable) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addNote(); }
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Delete selected stickers
            if (selectedStickers.length > 0) {
                e.preventDefault();
                deleteSelectedStickers();
                return;
            }
        }
        if (e.key === 'ArrowLeft' && currentBoardId > 1) switchToBoard(currentBoardId - 1);
        else if (e.key === 'ArrowRight' && currentBoardId < boardCount) switchToBoard(currentBoardId + 1);
        else if (e.key === 'n' && e.ctrlKey) { e.preventDefault(); createNewBoard(); }
        else if (e.key === 'd' && e.ctrlKey && currentBoardId > 1) { e.preventDefault(); deleteBoard(currentBoardId); }
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9 && keyNum <= boardCount) switchToBoard(keyNum);
    });
    window.addEventListener('resize', checkMobileView);
}

function updateAddButtonState() {
    const addButton = document.querySelector('.add-board-button');
    const disabled = boardCount >= MAX_BOARDS;
    addButton.classList.toggle('disabled', disabled);
    addButton.title = disabled ? `Maximum number of boards (${MAX_BOARDS}) reached` : "Add new board";
    updateShortcutHintVisibility();
}

function updateShortcutHintVisibility() {
    const shortcutHint = document.querySelector('.shortcut-hint');
    if (shortcutHint) shortcutHint.style.display = boardCount >= 2 ? 'block' : 'none';
}

function toggleBoardStyleMenu() {
    const styleMenu = document.querySelector('.board-style-menu');
    const isVisible = styleMenu.classList.contains('visible');
    if (!isVisible) {
        setActiveStyle();
        setupStyleOptions();
        document.querySelectorAll('.board-pattern-option, .pattern-preview').forEach(el => el.style.backgroundColor = boardStyles.colors.current);
        void styleMenu.offsetWidth; // Reflow
    }
    styleMenu.classList.toggle('visible', !isVisible);
    styleMenu.classList.toggle('closing', isVisible);
    if (isVisible) setTimeout(() => styleMenu.classList.remove('closing'), 300);
}

function setupStyleOptions() {
    if (document.querySelector('.board-color-option.initialized')) return;
    document.querySelectorAll('.board-color-option, .board-pattern-option').forEach(option => {
        option.classList.add('initialized');
        const type = option.classList.contains('board-color-option') ? 'color' : 'pattern';
        const value = option.getAttribute(`data-${type}`);
        option.addEventListener('click', () => {
            if (type === 'color') changeBoardColor(value);
            else changeBoardPattern(value);
            document.querySelectorAll(`.board-${type}-option`).forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });
}

function setActiveStyle() {
    ['color', 'pattern'].forEach(type => {
        document.querySelectorAll(`.board-${type}-option`).forEach(option => {
            option.classList.toggle('active', option.getAttribute(`data-${type}`) === boardStyles[`${type}s`].current);
        });
    });
}

function changeBoardColor(color) {
    boardStyles.colors.current = color;
    const activeBoard = document.querySelector('.board.active');
    activeBoard.style.backgroundColor = color;
    document.querySelectorAll('.pattern-preview, .board-pattern-option').forEach(el => {
        el.style.backgroundColor = color;
        if (el.classList.contains('board-pattern-option')) el.style.opacity = '0.8';
    });
    saveBoardStyles();
    updateBoardIndicators();
    activeBoard.style.transition = 'background-color 0.5s ease';
    setTimeout(() => activeBoard.style.transition = '', 500);
}

function createPatternOverlay(pattern) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0; transition:opacity 0.5s ease; opacity:0;';
    if (pattern !== 'none') {
        if (pattern === 'dots') overlay.style.cssText += 'background-image:radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px); background-size:20px 20px;';
        else if (pattern === 'grid') overlay.style.cssText += 'background-image:linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px); background-size:20px 20px;';
        else if (pattern === 'lines') overlay.style.cssText += 'background-image:linear-gradient(0deg, transparent 19px, rgba(255,255,255,0.4) 20px); background-size:20px 20px;';
        else if (pattern === 'weekdays' || pattern === 'days') {
            const header = document.createElement('div');
            header.className = pattern === 'weekdays' ? 'weekday-header' : 'day-header';
            const items = pattern === 'weekdays' ? ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] : ['Day 1','Day 2','Day 3','Day 4','Day 5'];
            items.forEach((item, index) => {
                const span = document.createElement('span');
                span.textContent = item;
                if (pattern === 'weekdays' && isCurrentDay(index)) {
                    span.classList.add('current-day');
                } else if (pattern === 'days' && getCurrentDayNumber(currentBoardId) === index) {
                    span.classList.add('current-day');
                }
                header.appendChild(span);
            });
            overlay.appendChild(header);
            
            // Add a class to the board to indicate it has a header
            const board = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
            if (board) {
                board.classList.add('has-header');
            }
        }
    } else {
        // Remove the has-header class when pattern is set to none
        const board = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
        if (board) {
            board.classList.remove('has-header');
        }
    }
    return overlay;
}

function changeBoardPattern(pattern) {
    const activeBoard = document.querySelector('.board.active');
    const boardId = activeBoard.dataset.boardId;
    const currentPattern = boardStyles.patterns.current;
    
    // Clean up days pattern data if switching away from days pattern
    if (currentPattern === 'days' && pattern !== 'days') {
        cleanupDaysPatternData(boardId);
    }
    
    // Update the current pattern after cleanup
    boardStyles.patterns.current = pattern;
    
    activeBoard.querySelectorAll('.pattern-overlay, .lines-overlay').forEach(el => el.remove());
    activeBoard.classList.remove('board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines', 'board-pattern-weekdays', 'board-pattern-days');

    // Save start date when days pattern is first applied
    if (pattern === 'days') {
        saveDaysPatternStartDate(boardId);
    }

    const patternOverlay = createPatternOverlay(pattern);
    activeBoard.appendChild(patternOverlay);
    void patternOverlay.offsetWidth; // Reflow
    patternOverlay.style.opacity = '1';

    let linesOverlay = null;
    if (pattern === 'weekdays' || pattern === 'days') {
        linesOverlay = document.createElement('div');
        linesOverlay.className = `lines-overlay lines-overlay-${pattern}`;
        linesOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0; opacity:0; transition:opacity 0.5s ease;';
        activeBoard.appendChild(linesOverlay);
        void linesOverlay.offsetWidth; // Reflow
        linesOverlay.style.opacity = '1';
    }

    setTimeout(() => {
        if (pattern === 'weekdays' || pattern === 'days') {
            activeBoard.classList.add(`board-pattern-${pattern}`);
            patternOverlay.style.height = 'auto';
            patternOverlay.style.zIndex = '1';
            patternOverlay.classList.add('pattern-overlay');
            if (linesOverlay) {
                linesOverlay.style.zIndex = '0';
                linesOverlay.classList.add('pattern-overlay'); // Naming consistency
            }
        } else {
            patternOverlay.remove();
            if (linesOverlay) linesOverlay.remove();
            if (pattern !== 'none') activeBoard.classList.add(`board-pattern-${pattern}`);
        }
        updateBoardIndicators();
    }, 500);
    saveBoardStyles();
}

function applyBoardSavedStyles(board, styles) {
    board.style.backgroundColor = styles.color;
    board.querySelectorAll('.pattern-overlay, .lines-overlay').forEach(el => el.remove());
    board.classList.remove('board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines', 'board-pattern-weekdays', 'board-pattern-days');

    if (styles.pattern !== 'none') {
        board.classList.add(`board-pattern-${styles.pattern}`);
        if (styles.pattern === 'weekdays' || styles.pattern === 'days') {
            const headerOverlay = document.createElement('div');
            headerOverlay.className = `pattern-overlay ${styles.pattern === 'weekdays' ? 'weekday-header' : 'day-header'}`;
            const items = styles.pattern === 'weekdays' ? ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] : Array.from({length: 5}, (_, i) => `Day ${i+1}`);
            items.forEach((item, index) => {
                const span = document.createElement('span');
                span.textContent = item;
                if (styles.pattern === 'weekdays' && isCurrentDay(index)) {
                    span.classList.add('current-day');
                } else if (styles.pattern === 'days' && getCurrentDayNumber(parseInt(board.dataset.boardId)) === index) {
                    span.classList.add('current-day');
                }
                headerOverlay.appendChild(span);
            });
            board.appendChild(headerOverlay);

            const linesOverlay = document.createElement('div');
            linesOverlay.className = `pattern-overlay lines-overlay lines-overlay-${styles.pattern}`;
            linesOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0;';
            board.appendChild(linesOverlay);
        }
    }
}

function loadBoardStyles(boardId) {
    const savedStyles = localStorage.getItem(`boardStyles_board_${boardId}`);
    const board = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!board) return;

    let stylesToApply;
    if (savedStyles) {
        stylesToApply = JSON.parse(savedStyles);
        if (boardId === currentBoardId) {
            boardStyles.colors.current = stylesToApply.color;
            boardStyles.patterns.current = stylesToApply.pattern;
        }
    } else {
        stylesToApply = { color: boardStyles.colors.default, pattern: boardStyles.patterns.default };
        if (boardId === currentBoardId) {
            boardStyles.colors.current = stylesToApply.color;
            boardStyles.patterns.current = stylesToApply.pattern;
        }
    }
    applyBoardSavedStyles(board, stylesToApply);
    updateBoardIndicators();
}

loadAllBoardTitles();
document.addEventListener('click', function(event) {
    const styleMenu = document.querySelector('.board-style-menu');
    const styleButton = document.querySelector('.board-style-button');
    if (styleMenu && styleMenu.classList.contains('visible') && styleButton &&
        !styleButton.contains(event.target) && !styleMenu.contains(event.target)) {
        styleMenu.classList.add('closing');
        styleMenu.classList.remove('visible');
        setTimeout(() => styleMenu.classList.remove('closing'), 300);
    }
});
document.querySelector('.board-style-menu').addEventListener('click', event => event.stopPropagation());

function loadAllBoardTitles() {
    document.querySelectorAll('.board').forEach(board => loadBoardTitle(board.dataset.boardId));
}

function saveBoardTitle(boardId, title) {
    localStorage.setItem(`stickyNotes_boardTitle_${boardId}`, title);
    const buttonElement = document.querySelector(`.board-button[data-board-id="${boardId}"]`);
    if (buttonElement && !buttonElement.dataset.originalNumber) {
        buttonElement.dataset.originalNumber = buttonElement.textContent;
    }
}

function updateCharCounter(input) {
    input.setAttribute('data-counter', `${input.value.length}/${input.maxLength}`);
}

function loadBoardTitle(boardId) {
    const title = localStorage.getItem(`stickyNotes_boardTitle_${boardId}`);
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (boardElement) {
        const titleInput = boardElement.querySelector('.board-title-input');
        if (titleInput && title) titleInput.value = title;
    }
    const buttonElement = document.querySelector(`.board-button[data-board-id="${boardId}"]`);
    if (buttonElement && !buttonElement.dataset.originalNumber) {
        buttonElement.dataset.originalNumber = buttonElement.textContent;
    }
}

function showBoardTitleTemporarily(boardId) {
    const titleCircle = document.querySelector(`.board[data-board-id="${boardId}"] .board-title-circle`);
    if (titleCircle) {
        titleCircle.classList.add('show-temporary');
        setTimeout(() => titleCircle.classList.remove('show-temporary'), 3000);
    }
}

function setupBoardTitleListeners() {
    document.querySelectorAll('.board-title-circle').forEach(circle => {
        let hoverTimeout;
        const input = circle.querySelector('.board-title-input');
        const boardId = circle.closest('.board').dataset.boardId;

        circle.addEventListener('mouseenter', () => {
            if (input) input.focus();
            clearTimeout(hoverTimeout);
            circle.classList.add('delayed-close');
        });
        circle.addEventListener('mouseleave', () => {
            hoverTimeout = setTimeout(() => circle.classList.remove('delayed-close'), 2000);
            if (input) input.blur();
        });
        circle.addEventListener('click', () => { if (input) input.focus(); });

        if (input) {
            let titleSaveTimeout;
            const saveTitleDebounced = () => {
                const title = input.value.trim();
                if (title.length === 0) { input.dataset.originalTitle = ''; return; }
                saveBoardTitle(boardId, title);
                updateCharCounter(input);
            };
            input.addEventListener('input', () => {
                clearTimeout(titleSaveTimeout);
                titleSaveTimeout = setTimeout(saveTitleDebounced, 500);
            });
            updateCharCounter(input);
        }
    });
}

function updateBoardIndicators() {
    for (let i = 1; i <= boardCount; i++) {
        const boardElement = document.querySelector(`.board[data-board-id="${i}"]`);
        const buttonElement = document.querySelector(`.board-button[data-board-id="${i}"]`);
        if (!boardElement || !buttonElement) continue;

        buttonElement.classList.toggle('has-notes', boardElement.querySelectorAll('.sticky-note').length > 0);
        const boardColor = boardElement.style.backgroundColor || boardStyles.colors.default;
        buttonElement.style.backgroundColor = boardColor;

        const patternClasses = ['board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines', 'board-pattern-weekdays', 'board-pattern-days'];
        let currentPatternClass = '';
        patternClasses.forEach(pc => {
            if (boardElement.classList.contains(pc)) currentPatternClass = pc;
            buttonElement.classList.remove(pc.replace('board-pattern', 'button-pattern'));
        });
        if (currentPatternClass) buttonElement.classList.add(currentPatternClass.replace('board-pattern', 'button-pattern'));

        const rgb = hexToRgb(boardColor) || { r: 26, g: 26, b: 26 };
        buttonElement.style.color = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? '#000' : '#fff';
    }
}