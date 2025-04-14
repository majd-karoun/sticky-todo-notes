// Board Management Functions
function createNewBoard() {
    // Don't allow creating new boards on mobile
    if (isMobileView) return;

    // Check if maximum boards limit reached
    if (boardCount >= MAX_BOARDS) {
        alert(`Maximum number of boards (${MAX_BOARDS}) reached.`);
        return;
    }

    boardCount++;
    createBoardUI(boardCount);
    saveBoardCount();

    // Remove auto-switching to the new board
    // switchToBoard(boardCount);

    // Update add button visibility based on board count
    updateAddButtonState();
}

function createBoardUI(boardId) {
    // Create board element
    const boardElement = document.createElement('div');
    boardElement.className = 'board';
    boardElement.dataset.boardId = boardId;
    document.querySelector('.boards-container').appendChild(boardElement);

    // Create navigation button
    const buttonElement = document.createElement('div');
    buttonElement.className = 'board-button new-button';
    buttonElement.dataset.boardId = boardId;
    buttonElement.textContent = boardId;
    buttonElement.addEventListener('click', () => switchToBoard(boardId));

    // Add delete button (except for board 1)
    if (boardId > 1) {
        const deleteButton = document.createElement('div');
        deleteButton.className = 'delete-board';
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering board switch
            deleteBoard(boardId);
        });
        buttonElement.appendChild(deleteButton);
    }

    // Insert before the add button
    const addButton = document.querySelector('.add-board-button');
    document.querySelector('.boards-navigation').insertBefore(buttonElement, addButton);

    // Remove animation class after animation completes
    setTimeout(() => {
        buttonElement.classList.remove('new-button');
    }, 500);

    // Initialize board styles
    loadBoardStyles(boardId);
}

function deleteBoard(boardId) {
    if (confirm(`Are you sure you want to delete board ${boardId}?`)) {
        // Get board element
        const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);

        if (boardElement) {
            // Get all notes on this board
            const notes = boardElement.querySelectorAll('.sticky-note');

            if (notes.length > 0) {
                // Mark all notes as done with animation
                const trashBin = document.querySelector('.trash-bin');
                const trashRect = trashBin.getBoundingClientRect();

                // Start trash bin shake animation
                trashBin.style.animation = 'binShake 0.5s ease-in-out';

                // Process each note
                notes.forEach(note => {
                    const content = note.querySelector('.sticky-content');
                    const isBold = content.classList.contains('bold');

                    // Save note data to deleted notes
                    const noteData = {
                        text: content.innerHTML,
                        color: note.style.backgroundColor,
                        x: note.style.left,
                        y: note.style.top,
                        width: note.style.width,
                        height: note.style.height,
                        timestamp: new Date().toLocaleString(),
                        isBold: isBold
                    };

                    deletedNotes.unshift(noteData); // deletedNotes is in utils.js

                    // Calculate animation path to trash
                    const noteRect = note.getBoundingClientRect();
                    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
                    const throwY = trashRect.top - noteRect.top;

                    note.style.setProperty('--throwX', `${throwX}px`);
                    note.style.setProperty('--throwY', `${throwY}px`);
                    note.style.animation = 'paperCrumble 0.5s ease-in forwards';
                });

                // Save deleted notes
                saveDeletedNotes(); // saveDeletedNotes is in utils.js
                updateTrashCount(); // updateTrashCount is in trash.js

                // Wait for animations to finish before removing board
                setTimeout(() => {
                    continueWithBoardDeletion(boardId);
                }, 600);
            } else {
                // No notes to animate, delete immediately
                continueWithBoardDeletion(boardId);
            }
        } else {
            // Board element not found, delete anyway
            continueWithBoardDeletion(boardId);
        }
    }
}

function continueWithBoardDeletion(boardId) {
    // Remove board from DOM
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (boardElement) {
        boardElement.remove();
    }

    // Animate board button removal
    const buttonElement = document.querySelector(`.board-button[data-board-id="${boardId}"]`);
    if (buttonElement) {
        buttonElement.classList.add('removing');
    }

    // Collect all buttons that need to be renumbered
    const buttonsToRenumber = [];
    for (let i = boardId + 1; i <= boardCount; i++) {
        const button = document.querySelector(`.board-button[data-board-id="${i}"]`);
        if (button) {
            button.classList.add('removing');
            buttonsToRenumber.push(i);
        }
    }

    // Remove board notes from localStorage
    const boardKey = `${ACTIVE_NOTES_KEY}_board_${boardId}`; // ACTIVE_NOTES_KEY is in utils.js
    localStorage.removeItem(boardKey);

    // Remove board styles from localStorage
    const boardStylesKey = `boardStyles_board_${boardId}`;
    localStorage.removeItem(boardStylesKey);

    // Wait for all removal animations to complete before creating new buttons
    setTimeout(() => {
        // Remove the deleted button
        if (buttonElement) {
            buttonElement.remove();
        }

        // Renumber boards and create new buttons one by one
        buttonsToRenumber.forEach((oldId, index) => {
            // First, remove the old button
            const oldButton = document.querySelector(`.board-button[data-board-id="${oldId}"]`);
            if (oldButton) {
                oldButton.remove();
            }

            // Update board element
            const board = document.querySelector(`.board[data-board-id="${oldId}"]`);
            const newId = oldId - 1;

            if (board) {
                board.dataset.boardId = newId;
            }

            // Create a new button
            const navigationContainer = document.querySelector('.boards-navigation');
            const addButton = document.querySelector('.add-board-button');

            const newButton = document.createElement('div');
            newButton.className = 'board-button new-button';
            newButton.dataset.boardId = newId;
            newButton.textContent = newId;
            newButton.addEventListener('click', () => switchToBoard(newId));

            // Add delete button for any board other than board 1
            if (newId > 1) {
                const deleteButton = document.createElement('div');
                deleteButton.className = 'delete-board';
                deleteButton.textContent = '×';
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteBoard(newId);
                });
                newButton.appendChild(deleteButton);
            }

            // Insert the new button before the add button
            navigationContainer.insertBefore(newButton, addButton);

            // Move board data in localStorage
            const oldKey = `${ACTIVE_NOTES_KEY}_board_${oldId}`;
            const newKey = `${ACTIVE_NOTES_KEY}_board_${newId}`;
            const boardData = localStorage.getItem(oldKey);

            if (boardData) {
                localStorage.setItem(newKey, boardData);
                localStorage.removeItem(oldKey);
            }

            // Move board styles in localStorage
            const oldStyleKey = `boardStyles_board_${oldId}`;
            const newStyleKey = `boardStyles_board_${newId}`;
            const boardStylesData = localStorage.getItem(oldStyleKey); // Renamed variable

            if (boardStylesData) {
                localStorage.setItem(newStyleKey, boardStylesData);
                localStorage.removeItem(oldStyleKey);
            }

            // Apply the board's existing style immediately
            loadBoardStyles(newId);
        });

        // Remove animation classes after a delay
        setTimeout(() => {
            document.querySelectorAll('.board-button.new-button').forEach(button => {
                button.classList.remove('new-button');
            });
        }, 500);

        // Update board count
        boardCount--; // boardCount is in utils.js
        saveBoardCount(); // saveBoardCount is in utils.js

        // Update add button state after deleting a board
        updateAddButtonState();

        // If we deleted the current board, switch to another board
        if (currentBoardId === boardId) { // currentBoardId is in utils.js
            // If there are boards with lower numbers, go to the previous board
            if (boardId > 1) {
                switchToBoard(boardId - 1);
            } else if (boardCount >= 1) {
                // Otherwise go to the next board (now renumbered)
                switchToBoard(1);
            }
        } else if (currentBoardId > boardId) {
            // If we're on a board with a higher number, adjust the current board ID
            // since the boards have been renumbered
            currentBoardId--;
            switchToBoard(currentBoardId);
        }

        // Reset trash bin animation
        document.querySelector('.trash-bin').style.animation = '';
    }, 350); // Wait a bit longer than the animation duration
}

function switchToBoard(boardId) {
    // On mobile devices, only allow board 1
    if (isMobileView && boardId !== 1) { // isMobileView is in utils.js
        return;
    }

    const targetBoardId = parseInt(boardId);
    const previousBoardId = currentBoardId; // currentBoardId is in utils.js

    // If we're already on this board, do nothing
    if (targetBoardId === previousBoardId) return;

    // Calculate direction for animation
    const isMovingForward = targetBoardId > previousBoardId;

    // Update current board ID
    currentBoardId = targetBoardId;

    // Update last note position and color for the new board
    if (!lastNotePositions[boardId]) { // lastNotePositions is in utils.js
        lastNotePositions[boardId] = {
            x: window.innerWidth / 2 - 100,
            y: window.innerHeight / 2 - 75
        };
    }
    if (!lastNoteColors[boardId]) { // lastNoteColors is in utils.js
        lastNoteColors[boardId] = colors[0]; // colors is in utils.js
    }

    // Update board display
    document.querySelectorAll('.board').forEach(board => {
        const id = parseInt(board.dataset.boardId);

        // Clear all classes first
        board.classList.remove('active', 'prev', 'next');

        if (id === currentBoardId) {
            board.classList.add('active');
            board.style.visibility = 'visible';

            // Apply staggered animation to notes
            const notes = board.querySelectorAll('.sticky-note');
            notes.forEach((note, index) => {
                note.style.setProperty('--note-index', index);
            });
        } else if (id < currentBoardId) {
            board.classList.add('prev');
            setTimeout(() => {
                if (board.classList.contains('prev')) {
                    board.style.visibility = 'hidden';
                }
            }, 500); // Match transition duration
        } else {
            board.classList.add('next');
            setTimeout(() => {
                if (board.classList.contains('next')) {
                    board.style.visibility = 'hidden';
                }
            }, 500); // Match transition duration
        }
    });

    // Update navigation buttons
    document.querySelectorAll('.board-button').forEach(button => {
        if (parseInt(button.dataset.boardId) === currentBoardId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Load board styles for the new active board
    loadBoardStyles(currentBoardId);

    // Update style indicators in the menu if it's open
    setActiveStyle();

    // Update pattern option buttons to match the new board color
    const patternOptions = document.querySelectorAll('.board-pattern-option');
    patternOptions.forEach(option => {
        option.style.backgroundColor = boardStyles.colors.current; // boardStyles is in utils.js
    });

    // Update pattern previews to match the new board color
    const patternPreviews = document.querySelectorAll('.pattern-preview');
    patternPreviews.forEach(preview => {
        preview.style.backgroundColor = boardStyles.colors.current;
    });

    updateBoardIndicators();
}

// Setup event listeners for board navigation
function setupBoardNavigation() {
    // Add click handler to add board button
    document.querySelector('.add-board-button').addEventListener('click', createNewBoard);

    // Add click handlers to all existing board buttons, including board 1
    document.querySelectorAll('.board-button').forEach(button => {
        const boardId = parseInt(button.dataset.boardId);
        // Remove any existing listeners first (to avoid duplicates)
        const newButton = button.cloneNode(true);

        // Set up click handler for the board button
        newButton.addEventListener('click', () => switchToBoard(boardId));

        // Set up click handler for the delete button if it exists
        const deleteButton = newButton.querySelector('.delete-board');
        if (deleteButton) {
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBoard(boardId);
            });
        }

        button.parentNode.replaceChild(newButton, button);
    });

    // Add touch swiping for mobile
    let startX, startY;

    document.querySelector('.boards-container').addEventListener('touchstart', (e) => {
        // Don't track swipes if in mobile view
        if (isMobileView) return; // isMobileView is in utils.js

        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.querySelector('.boards-container').addEventListener('touchend', (e) => {
        // Don't process swipes if in mobile view
        if (isMobileView) return;

        if (!startX) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        const diffX = startX - endX;
        const diffY = startY - endY;

        // Only register horizontal swipes if they're more horizontal than vertical
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0 && currentBoardId < boardCount) { // currentBoardId, boardCount are in utils.js
                // Swipe left - go to next board
                switchToBoard(currentBoardId + 1);
            } else if (diffX < 0 && currentBoardId > 1) {
                // Swipe right - go to previous board
                switchToBoard(currentBoardId - 1);
            }
        }

        startX = null;
        startY = null;
    });

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Don't handle board navigation keyboard shortcuts on mobile
        if (isMobileView) return;

        // Check for standalone Cmd (Mac) or Ctrl (Windows) key press to focus textarea
        if ((e.key === 'Control' || e.key === 'Meta') &&
            !e.altKey && !e.shiftKey &&
            e.target.tagName !== 'TEXTAREA' && e.target.getAttribute('contenteditable') !== 'true') {
            e.preventDefault();
            document.querySelector('.note-input textarea').focus();
            return;
        }

        // Avoid capturing keyboard events when focused on text areas or editable content
        if (e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true') {
            // Handle Cmd+Enter or Ctrl+Enter in textarea to add a note
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                addNote(); // addNote is in note.js
                return;
            }
            return;
        }

        // Arrow left/right for navigation
        if (e.key === 'ArrowLeft' && currentBoardId > 1) {
            switchToBoard(currentBoardId - 1);
        } else if (e.key === 'ArrowRight' && currentBoardId < boardCount) {
            switchToBoard(currentBoardId + 1);
        } else if (e.key === 'n' && e.ctrlKey) {
            // Ctrl+N for new board
            e.preventDefault();
            createNewBoard();
        } else if (e.key === 'd' && e.ctrlKey && currentBoardId > 1) {
            // Ctrl+D to delete current board (except board 1)
            e.preventDefault();
            deleteBoard(currentBoardId);
        } else if (e.key === 't' || e.key === 'T') {
            // 't' key to toggle trash bin
            toggleTrashModal(); // toggleTrashModal is in trash.js
        }

        // Number keys 1-9 for direct board access
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9 && keyNum <= boardCount) {
            switchToBoard(keyNum);
        }
    });

    // Add resize listener to handle switching between mobile and desktop
    window.addEventListener('resize', () => {
        checkMobileView(); // checkMobileView is in utils.js
    });
}

// Add a function to update add button state
function updateAddButtonState() {
    const addButton = document.querySelector('.add-board-button');
    if (boardCount >= MAX_BOARDS) { // boardCount, MAX_BOARDS are in utils.js
        addButton.classList.add('disabled');
        addButton.title = `Maximum number of boards (${MAX_BOARDS}) reached`;
    } else {
        addButton.classList.remove('disabled');
        addButton.title = "Add new board";
    }

    // Update shortcut hint visibility based on board count
    updateShortcutHintVisibility();
}

// Function to update shortcut hint visibility
function updateShortcutHintVisibility() {
    const shortcutHint = document.querySelector('.shortcut-hint');
    if (shortcutHint) {
        // Only show hint if there are 2 or more boards
        if (boardCount >= 2) { // boardCount is in utils.js
            shortcutHint.style.display = 'block';
        } else {
            shortcutHint.style.display = 'none';
        }
    }
}

// Board Styling Functions
function toggleBoardStyleMenu() {
    const styleMenu = document.querySelector('.board-style-menu');

    if (!styleMenu.classList.contains('visible')) {
        // Prepare menu before showing
        setActiveStyle();
        setupStyleOptions();

        // Update pattern option buttons to match current board color
        const patternOptions = document.querySelectorAll('.board-pattern-option');
        patternOptions.forEach(option => {
            option.style.backgroundColor = boardStyles.colors.current; // boardStyles is in utils.js
        });

        // Update pattern previews to match current board color
        const patternPreviews = document.querySelectorAll('.pattern-preview');
        patternPreviews.forEach(preview => {
            preview.style.backgroundColor = boardStyles.colors.current;
        });

        // Force a layout reflow before adding the visible class
        void styleMenu.offsetWidth;

        // Show the menu
        styleMenu.classList.add('visible');
    } else {
        // Add closing class for animation
        styleMenu.classList.add('closing');
        styleMenu.classList.remove('visible');

        // Remove the closing class after animation completes
        setTimeout(() => {
            styleMenu.classList.remove('closing');
        }, 300); // Match the animation duration in CSS
    }
}

function setupStyleOptions() {
    // Setup only once
    if (document.querySelector('.board-color-option.initialized')) return;

    // Setup color options
    const colorOptions = document.querySelectorAll('.board-color-option');
    colorOptions.forEach(option => {
        option.classList.add('initialized');
        option.addEventListener('click', () => {
            const color = option.getAttribute('data-color');
            changeBoardColor(color);

            // Update active state
            colorOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });

    // Setup pattern options
    const patternOptions = document.querySelectorAll('.board-pattern-option');
    patternOptions.forEach(option => {
        option.classList.add('initialized');
        option.addEventListener('click', () => {
            const pattern = option.getAttribute('data-pattern');
            changeBoardPattern(pattern);

            // Update active state
            patternOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
        });
    });
}

function setActiveStyle() {
    // Set active color
    const colorOptions = document.querySelectorAll('.board-color-option');
    colorOptions.forEach(option => {
        if (option.getAttribute('data-color') === boardStyles.colors.current) { // boardStyles is in utils.js
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });

    // Set active pattern
    const patternOptions = document.querySelectorAll('.board-pattern-option');
    patternOptions.forEach(option => {
        if (option.getAttribute('data-pattern') === boardStyles.patterns.current) { // boardStyles is in utils.js
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

function changeBoardColor(color) {
    // Store current color
    boardStyles.colors.current = color; // boardStyles is in utils.js

    // Apply to active board
    const activeBoard = document.querySelector('.board.active');
    activeBoard.style.backgroundColor = color;

    // Save to localStorage
    saveBoardStyles(); // saveBoardStyles is in utils.js

    // Update the board navigation buttons to match
    updateBoardIndicators();

    // Apply animation
    activeBoard.style.transition = 'background-color 0.5s ease';
    setTimeout(() => {
        activeBoard.style.transition = '';
    }, 500);
}

function changeBoardPattern(pattern) {
    // Store current pattern
    boardStyles.patterns.current = pattern; // boardStyles is in utils.js

    // Apply to active board
    const activeBoard = document.querySelector('.board.active');

    // Create an overlay element for the transition
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '0';
    overlay.style.transition = 'opacity 0.5s ease';

    // Set the background pattern on the overlay instead of directly on the board
    if (pattern !== 'none') {
        if (pattern === 'dots') {
            overlay.style.backgroundImage = 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)';
            overlay.style.backgroundSize = '20px 20px';
        } else if (pattern === 'grid') {
            overlay.style.backgroundImage = 'linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px)';
            overlay.style.backgroundSize = '20px 20px';
        } else if (pattern === 'lines') {
            overlay.style.backgroundImage = 'linear-gradient(0deg, transparent 19px, rgba(255, 255, 255, 0.4) 20px)';
            overlay.style.backgroundSize = '20px 20px';
        }
    }

    // Start with opacity 0
    overlay.style.opacity = '0';

    // Remove all pattern classes from the board
    activeBoard.classList.remove('board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines');

    // Add the overlay to the board
    activeBoard.appendChild(overlay);

    // Force a reflow to ensure the transition works
    void overlay.offsetWidth;

    // Fade in the pattern
    overlay.style.opacity = '1';

    // After the transition completes, apply the pattern directly to the board
    setTimeout(() => {
        // Remove the overlay
        overlay.remove();

        // Apply the pattern class to the board
        if (pattern !== 'none') {
            activeBoard.classList.add(`board-pattern-${pattern}`);
        }

        // Update the board navigation buttons to match
        updateBoardIndicators();
    }, 500);

    // Save to localStorage
    saveBoardStyles(); // saveBoardStyles is in utils.js
}

function loadBoardStyles(boardId) {
    // Load board styles from localStorage
    const boardStylesKey = `boardStyles_board_${boardId}`;
    const savedStyles = localStorage.getItem(boardStylesKey);

    if (savedStyles) {
        const styles = JSON.parse(savedStyles);
        // Apply to the board
        const board = document.querySelector(`.board[data-board-id="${boardId}"]`);
        if (board) {
            // Apply color
            board.style.backgroundColor = styles.color;

            // Apply pattern
            board.classList.remove('board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines');
            if (styles.pattern !== 'none') {
                board.classList.add(`board-pattern-${styles.pattern}`);
            }
        }

        // If loading styles for the current board, update the global state
        if (boardId === currentBoardId) {
            boardStyles.colors.current = styles.color;
            boardStyles.patterns.current = styles.pattern;
        }

    } else {
         // If loading styles for the current board, reset to defaults
        if (boardId === currentBoardId) {
            boardStyles.colors.current = boardStyles.colors.default;
            boardStyles.patterns.current = boardStyles.patterns.default;
        }
         // Apply default styles to the board element
        const board = document.querySelector(`.board[data-board-id="${boardId}"]`);
        if (board) {
            board.style.backgroundColor = boardStyles.colors.default;
            board.classList.remove('board-pattern-dots', 'board-pattern-grid', 'board-pattern-lines');
        }
    }

    // Update board button styles to match
    updateBoardIndicators();
}

// Close board style menu when clicking outside
document.addEventListener('click', function(event) {
    const styleButton = document.querySelector('.board-style-button');
    const styleMenu = document.querySelector('.board-style-menu');

    // Check if the menu exists and is visible
    if (styleMenu && styleMenu.classList.contains('visible') &&
        styleButton && !styleButton.contains(event.target) &&
        !styleMenu.contains(event.target)) { // Ensure click is not inside the menu itself

        // Add closing class for animation
        styleMenu.classList.add('closing');
        styleMenu.classList.remove('visible');

        // Remove the closing class after animation completes
        setTimeout(() => {
            styleMenu.classList.remove('closing');
        }, 300); // Match the animation duration in CSS
    }
});


// Prevent menu from closing when clicking inside it
document.querySelector('.board-style-menu').addEventListener('click', function(event) {
    event.stopPropagation();
});

// Add this function to update board indicators
function updateBoardIndicators() {
    // Loop through all boards
    for (let i = 1; i <= boardCount; i++) { // boardCount is in utils.js
        const boardElement = document.querySelector(`.board[data-board-id="${i}"]`);
        const buttonElement = document.querySelector(`.board-button[data-board-id="${i}"]`);

        if (!boardElement || !buttonElement) continue;

        // Check if board has any notes
        const hasNotes = boardElement.querySelectorAll('.sticky-note').length > 0;

        // Update button class
        if (hasNotes) {
            buttonElement.classList.add('has-notes');
        } else {
            buttonElement.classList.remove('has-notes');
        }

        // Get board background color
        const boardColor = boardElement.style.backgroundColor || boardStyles.colors.default; // Use default if not set

        // Set button background color to match board
        buttonElement.style.backgroundColor = boardColor;

        // Find if the board has a pattern and which one
        let patternClass = '';
        if (boardElement.classList.contains('board-pattern-dots')) {
            patternClass = 'board-pattern-dots';
        } else if (boardElement.classList.contains('board-pattern-grid')) {
            patternClass = 'board-pattern-grid';
        } else if (boardElement.classList.contains('board-pattern-lines')) {
            patternClass = 'board-pattern-lines';
        }

        // Remove any existing pattern classes from button
        buttonElement.classList.remove('button-pattern-dots', 'button-pattern-grid', 'button-pattern-lines');

        // Apply matching pattern class to button if board has a pattern
        if (patternClass) {
            // Convert to button-specific pattern class
            const buttonPatternClass = patternClass.replace('board-pattern', 'button-pattern');
            buttonElement.classList.add(buttonPatternClass);
        }

        // Adjust text color based on background color brightness
        const rgb = hexToRgb(boardColor) || { r: 26, g: 26, b: 26 }; // default to #1a1a1a, hexToRgb is in utils.js
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

        // Use white text for dark backgrounds, black text for light backgrounds
        buttonElement.style.color = brightness > 128 ? '#000' : '#fff';
    }
}
