// Global Variables
const colors = [
    '#f0e68c', // Khaki
    '#98ff98', // Light green
    '#ff7eb9', // Pink
    '#7afcff', // Cyan
    '#FE8801', // Orange
    '#ec0c39', // red
    '#AF65EF', // Purple
    '#ffd700', // Yellow
    '#C1C1C1', // Grey
    '#FFFFFF'  // White
];

const boardStyles = {
    colors: {
        default: '#1a1a1a',
        current: '#1a1a1a'
    },
    patterns: {
        default: 'none',
        current: 'none'
    }
};

let deletedNotes = [];
let holdTimer;
let activeNote = null;
let activePalette = null;

// Store last note position and color for each board
const lastNotePositions = {};
const lastNoteColors = {};

// Initialize default values for board 1
lastNotePositions[1] = {
    x: window.innerWidth / 2 - 100, // Default center position
    y: window.innerHeight / 2 - 75
};
lastNoteColors[1] = colors[0];

// Boards related variables
let currentBoardId = 1;
let boardCount = 1;
let isMobileView = false;
const MAX_BOARDS = 9;

// Local Storage Keys
const ACTIVE_NOTES_KEY = 'stickyNotes_active';
const DELETED_NOTES_KEY = 'stickyNotes_deleted';
const BOARDS_COUNT_KEY = 'stickyNotes_boardCount';

// Helper function to check if we're on a mobile device
function checkMobileView() {
    isMobileView = window.innerWidth <= 768;
    
    // On mobile, always show board 1
    if (isMobileView && currentBoardId !== 1) {
        switchToBoard(1);
    }
}

// Helper function to parse position values
function parsePosition(value) {
    if (!value) return 0;
    return parseInt(value.replace('px', '')) || 0;
}

function getNextNotePosition(lastX, lastY) {
    // Add slight random horizontal offset 
    const horizontalOffset = Math.random() * 10 - 5;
    let newX = lastX + horizontalOffset;
    let newY = lastY + 55;  // Move 55px down
    
    // Screen boundaries (with 5px padding)
    const padding = 5;
    const maxX = window.innerWidth - 150; 
    const maxY = window.innerHeight - 100;
    
    // Reset to top if note would go off bottom of screen
    if (newY > maxY) {
        newY = padding;
        newX = padding + Math.random() * (maxX - padding);  // Random x position at top
    }
    
    // Ensure within bounds
    newX = Math.min(Math.max(newX, -padding), maxX);
    newY = Math.min(Math.max(newY, -padding), maxY);
    
    return { x: newX, y: newY };
}

// Load saved notes on startup
function loadSavedNotes() {
    // Check for mobile view
    checkMobileView();
    
    // Load board count
    const savedBoardCount = localStorage.getItem(BOARDS_COUNT_KEY);
    if (savedBoardCount) {
        boardCount = parseInt(savedBoardCount);
        // Ensure board count doesn't exceed maximum
        if (boardCount > MAX_BOARDS) {
            boardCount = MAX_BOARDS;
            saveBoardCount();
        }
        
        // Create the saved boards in the UI
        for (let i = 2; i <= boardCount; i++) {
            createBoardUI(i);
        }
    }

    // Update add button state
    updateAddButtonState();

    // Load notes for all boards
    for (let i = 1; i <= boardCount; i++) {
        const boardKey = `${ACTIVE_NOTES_KEY}_board_${i}`;
        const savedNotes = localStorage.getItem(boardKey);
        
        if (savedNotes) {
            JSON.parse(savedNotes).forEach(note => {
                // Update last note position and color for this board
                lastNotePositions[i] = {
                    x: parsePosition(note.x),
                    y: parsePosition(note.y)
                };
                lastNoteColors[i] = note.color;
                
                createNote(
                    note.text, 
                    note.color, 
                    parsePosition(note.x), 
                    parsePosition(note.y), 
                    true, 
                    note.width, 
                    note.height,
                    note.isBold,
                    i
                );
            });
        }
    }

    // Load board styles for all boards
    for (let i = 1; i <= boardCount; i++) {
        loadBoardStyles(i);
    }

    // Show the first board
    switchToBoard(1);

    // Load deleted notes
    const savedDeletedNotes = localStorage.getItem(DELETED_NOTES_KEY);
    if (savedDeletedNotes) {
        deletedNotes = JSON.parse(savedDeletedNotes);
        updateTrashCount();
    }

    // Update indicators after loading notes
    updateBoardIndicators();
    
    // Update shortcut hint visibility
    updateShortcutHintVisibility();
}

// Save active notes to localStorage
function saveActiveNotes() {
    // Save notes for the current board
    const boardKey = `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`;
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    
    const notes = Array.from(boardElement.querySelectorAll('.sticky-note')).map(note => ({
        text: note.querySelector('.sticky-content').innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width || '200px',
        height: note.style.height || '150px',
        isBold: note.querySelector('.sticky-content').classList.contains('bold')
    }));
    
    localStorage.setItem(boardKey, JSON.stringify(notes));
    
    // Update board indicators to reflect the current state
    updateBoardIndicators();
}

// Save deleted notes to localStorage.
function saveDeletedNotes() {
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deletedNotes));
}

// Save board count to localStorage
function saveBoardCount() {
    localStorage.setItem(BOARDS_COUNT_KEY, boardCount.toString());
}

// Note Creation and Management
function addNote() {
    const textarea = document.querySelector('.note-input textarea');
    const text = textarea.value.trim();
    
    if (!text) return;  // Don't create empty notes
    
    // Get the last added note's position and color for this board
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    const notes = Array.from(boardElement.querySelectorAll('.sticky-note'));
    const lastAddedNote = notes[notes.length - 1];
    
    let lastX = lastNotePositions[currentBoardId].x;
    let lastY = lastNotePositions[currentBoardId].y;
    let lastColor = lastNoteColors[currentBoardId];
    
    if (lastAddedNote) {
        // Use the last added note's position and color
        lastX = parsePosition(lastAddedNote.style.left);
        lastY = parsePosition(lastAddedNote.style.top);
        lastColor = lastAddedNote.style.backgroundColor;
    }
    
    // Get next position based on the last added note's position
    const nextPosition = getNextNotePosition(lastX, lastY);
    
    // Create the note on the current board
    createNote(
        text.replace(/\n/g, '<br>'),
        lastColor,
        nextPosition.x,
        nextPosition.y,
        false,
        '200px',
        '150px',
        false,
        currentBoardId
    );
    
    // Update the last position and color for this board
    lastNotePositions[currentBoardId] = nextPosition;
    lastNoteColors[currentBoardId] = lastColor;
    
    // Clear the input
    textarea.value = '';

    saveActiveNotes();
    updateBoardIndicators();
}

function createNote(text, color, x, y, isRestored = false, width = '200px', height = '150px', isBold = false, boardId = currentBoardId) {
    const note = document.createElement('div');
    note.className = 'sticky-note';
    note.style.backgroundColor = color;
    note.style.left = typeof x === 'number' ? `${x}px` : x;
    note.style.top = typeof y === 'number' ? `${y}px` : y;
    note.style.width = width;
    note.style.height = height;
    
    note.innerHTML = `
        <div class="sticky-content ${isBold ? 'bold' : ''}" contenteditable="true">${text}</div>
        <div class="note-controls">
            <div class="color-button" style="background-color: ${color}">
                <div class="color-palette">
                    ${colors.map(c => `
                        <div class="color-option" style="background-color: ${c}"
                             onclick="changeNoteColor(this, '${c}')"></div>
                    `).join('')}
                </div>
            </div>
            <button  class="bold-toggle ${isBold ? 'active' : ''}" onclick="toggleBold(this)">B</button>
            <button class="done-button" onclick="markAsDone(this.closest('.sticky-note'))">✓</button>
        </div>
        <div class="resize-handle"></div>
    `;

    setupNote(note);
    
    // Add the note to the correct board
    const boardElement = document.querySelector(`.board[data-board-id="${boardId}"]`);
    boardElement.appendChild(note);

    // Apply paperPop animation to all notes, even when restored
    note.style.animation = 'paperPop 0.3s ease-out forwards';
    
    if (!isRestored) {
        saveActiveNotes();
    }

    return note;
}

function setupNote(note) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, initialX, initialY, initialW, initialH;

    const colorButton = note.querySelector('.color-button');
    const colorPalette = note.querySelector('.color-palette');
    const content = note.querySelector('.sticky-content');

    // Content change handler
    const saveContent = () => {
        saveActiveNotes();
    };

    content.addEventListener('blur', saveContent);
    content.addEventListener('input', saveContent);

    // Track position after movement ends
    function updateLastPosition() {
        const rect = note.getBoundingClientRect();
        lastNotePositions[currentBoardId].x = rect.left;
        lastNotePositions[currentBoardId].y = rect.top;
    }

    // Color picker toggle
    colorButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // If this palette is already active, don't do anything
        if (activePalette === colorPalette) {
            return;
        }
        
        // Hide other palettes if any are open
        if (activePalette) {
            hideAllColorPalettes();
        }
        
        showColorPalette(colorPalette);
    });

    // Content editing events
    content.addEventListener('dblclick', () => {
        content.contentEditable = "true";
        content.focus();
    });

    content.addEventListener('blur', () => {
        content.contentEditable = "false";
        saveActiveNotes();
    });

    content.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            content.contentEditable = "false";
            saveActiveNotes();
        }
    });

    // Mouse events setup
    note.addEventListener('mousedown', startHandler);
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);

    // Touch events setup
    note.addEventListener('touchstart', e => startHandler(e.touches[0]));
    document.addEventListener('touchmove', e => moveHandler(e.touches[0]));
    document.addEventListener('touchend', endHandler);

    function startHandler(e) {
        if (e.target.closest('.color-palette') || 
            e.target.closest('.done-button')) return;

        startX = e.clientX;
        startY = e.clientY;
        
        if (e.target.closest('.resize-handle')) {
            isResizing = true;
            initialW = note.offsetWidth;
            initialH = note.offsetHeight;
        } else {
            const rect = note.getBoundingClientRect();
            initialX = parsePosition(note.style.left);
            initialY = parsePosition(note.style.top);
            
            holdTimer = setTimeout(() => {
                isDragging = true;
                note.style.zIndex = '1000';
            }, 150);
        }
        
        activeNote = note;
    }

    function moveHandler(e) {
        if (!activeNote || activeNote !== note) return;
    
        if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
            clearTimeout(holdTimer);
        }
    
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            // Calculate new position
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            // Reduced padding and allow partial overflow
            const padding = 5;  // Reduced from 20
            const minX = -padding;
            const minY = -padding;
            const maxX = window.innerWidth - (note.offsetWidth / 4);  // Allow 3/4 of note to go off-screen
            const maxY = window.innerHeight - (note.offsetHeight / 4); // Allow 3/4 of note to go off-screen
            
            newX = Math.min(Math.max(newX, minX), maxX);
            newY = Math.min(Math.max(newY, minY), maxY);
            
            note.style.left = `${newX}px`;
            note.style.top = `${newY}px`;
        }
    
        if (isResizing) {
            const minWidth = 150;
            const minHeight = 150;
            const maxWidth = window.innerWidth - parsePosition(note.style.left) + 50;  // Allow overflow
            const maxHeight = window.innerHeight - parsePosition(note.style.top) + 50; // Allow overflow
            
            const newWidth = Math.min(Math.max(initialW + e.clientX - startX, minWidth), maxWidth);
            const newHeight = Math.min(Math.max(initialH + e.clientY - startY, minHeight), maxHeight);
            
            note.style.width = `${newWidth}px`;
            note.style.height = `${newHeight}px`;
        }
    }

    function endHandler() {
        clearTimeout(holdTimer);
        if (isDragging || isResizing) {
            saveActiveNotes();
            if (isDragging) {
                updateLastPosition();
                checkTrashCollision(note);
            }
        }
        isDragging = false;
        isResizing = false;
        note.style.zIndex = '';
        activeNote = null;
    }
}

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
                    
                    deletedNotes.unshift(noteData);
                    
                    // Calculate animation path to trash
                    const noteRect = note.getBoundingClientRect();
                    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
                    const throwY = trashRect.top - noteRect.top;
                    
                    note.style.setProperty('--throwX', `${throwX}px`);
                    note.style.setProperty('--throwY', `${throwY}px`);
                    note.style.animation = 'paperCrumble 0.5s ease-in forwards';
                });
                
                // Save deleted notes
                saveDeletedNotes();
                updateTrashCount();
                
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
    const boardKey = `${ACTIVE_NOTES_KEY}_board_${boardId}`;
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
            const boardStyles = localStorage.getItem(oldStyleKey);
            
            if (boardStyles) {
                localStorage.setItem(newStyleKey, boardStyles);
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
        boardCount--;
        saveBoardCount();
        
        // Update add button state after deleting a board
        updateAddButtonState();
        
        // If we deleted the current board, switch to another board
        if (currentBoardId === boardId) {
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
    if (isMobileView && boardId !== 1) {
        return;
    }
    
    const targetBoardId = parseInt(boardId);
    const previousBoardId = currentBoardId;
    
    // If we're already on this board, do nothing
    if (targetBoardId === previousBoardId) return;
    
    // Calculate direction for animation
    const isMovingForward = targetBoardId > previousBoardId;
    
    // Update current board ID
    currentBoardId = targetBoardId;
    
    // Update last note position and color for the new board
    if (!lastNotePositions[boardId]) {
        lastNotePositions[boardId] = {
            x: window.innerWidth / 2 - 100,
            y: window.innerHeight / 2 - 75
        };
    }
    if (!lastNoteColors[boardId]) {
        lastNoteColors[boardId] = colors[0];
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
        option.style.backgroundColor = boardStyles.colors.current;
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
        if (isMobileView) return;
        
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
            if (diffX > 0 && currentBoardId < boardCount) {
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
        
        // Avoid capturing keyboard events when focused on text areas or editable content
        if (e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true') {
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
            toggleTrashModal();
        }
        
        // Number keys 1-9 for direct board access
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 9 && keyNum <= boardCount) {
            switchToBoard(keyNum);
        }
    });
    
    // Add resize listener to handle switching between mobile and desktop
    window.addEventListener('resize', () => {
        checkMobileView();
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    loadSavedNotes();
    setupBoardNavigation();
});

// Color Management
function hideAllColorPalettes() {
    document.querySelectorAll('.color-palette').forEach(palette => {
        if (palette.style.display !== 'none') {
            palette.classList.add('closing');
            setTimeout(() => {
                palette.style.display = 'none';
                palette.classList.remove('closing');
            }, 200);
        }
    });
    activePalette = null;
}

function showColorPalette(palette) {
    // First remove any existing classes to ensure clean state
    palette.classList.remove('closing', 'opening');
    
    // Force a reflow
    void palette.offsetWidth;
    
    palette.style.display = 'grid';
    palette.classList.add('opening');
    activePalette = palette;
}


document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
});


function changeNoteColor(option, color) {
    const note = option.closest('.sticky-note');
    note.style.backgroundColor = color;
    note.querySelector('.color-button').style.backgroundColor = color;
    lastNoteColors[currentBoardId] = color;
    saveActiveNotes();
}

function toggleBold(button) {
    const note = button.closest('.sticky-note');
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.toggle('bold');
    button.classList.toggle('active');
    saveActiveNotes();
}

// Bin Management
function markAsDone(note) {
    const content = note.querySelector('.sticky-content');
    const isBold = content.classList.contains('bold');
    
    const noteData = {
        text: content.innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left,
        y: note.style.top,
        width: note.style.width,
        height: note.style.height,
        timestamp: new Date().toLocaleString(),
        isBold: isBold // Save the bold state
    };

    deletedNotes.unshift(noteData);
    saveDeletedNotes();
    updateTrashCount();

    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    const throwX = trashRect.left - noteRect.left + (trashRect.width / 2) - (noteRect.width / 2);
    const throwY = trashRect.top - noteRect.top;

    note.style.setProperty('--throwX', `${throwX}px`);
    note.style.setProperty('--throwY', `${throwY}px`);
    note.style.animation = 'paperCrumble 0.5s ease-in forwards';
    
    // Start bin shake animation immediately instead of after delay
    trashBin.style.animation = 'binShake 0.5s ease-in-out';

    setTimeout(() => {
        note.remove();
        trashBin.style.animation = '';
        saveActiveNotes();
    }, 500);
}

function checkTrashCollision(note) {
    const trashBin = document.querySelector('.trash-bin');
    const trashRect = trashBin.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();

    if (noteRect.right > trashRect.left && 
        noteRect.left < trashRect.right && 
        noteRect.bottom > trashRect.top && 
        noteRect.top < trashRect.bottom) {
        markAsDone(note);
        return true;
    }
    return false;
}

// Trash Modal Management
function toggleTrashModal() {
    const modal = document.getElementById('trashModal');
    const isVisible = modal.classList.contains('visible');
    
    if (!isVisible) {
        modal.style.display = 'block';
        modal.offsetHeight; // Force reflow
        modal.classList.add('visible');
        renderDeletedNotes();
    } else {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function renderDeletedNotes() {
    const container = document.querySelector('.deleted-notes-container');
    
    if (deletedNotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                (Empty)
            </div>`;
        return;
    }
    
    container.innerHTML = deletedNotes.map((note, index) => `
        <div class="deleted-note" style="background-color: ${note.color}">
            <div class="deleted-note-content ${note.isBold ? 'bold' : ''}">${note.text}</div>
            <div class="deleted-note-actions">
                <button class="restore-btn" onclick="restoreNote(${index})">Restore</button>
                <button class="delete-btn" onclick="deleteNotePermanently(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}
function restoreNote(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.2s ease-out forwards';
    
    setTimeout(() => {
        const note = deletedNotes[index];
        
        // Create the note with its bold state
        const restoredNote = createNote(
            note.text,
            note.color,
            parsePosition(note.x),
            parsePosition(note.y),
            true,
            note.width,
            note.height,
            note.isBold  // Pass the bold state
        );

        restoredNote.style.animation = 'paperPop 0.3s ease-out forwards';
        
        deletedNotes.splice(index, 1);
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes();
        saveActiveNotes();
    }, 300);

    updateBoardIndicators();
}


function deleteNotePermanently(index) {
    const noteElement = document.querySelectorAll('.deleted-note')[index];
    noteElement.classList.add('removing');
    noteElement.style.animation = 'noteDelete 0.3s ease-out forwards';
    
    setTimeout(() => {
        deletedNotes.splice(index, 1);
        saveDeletedNotes();
        updateTrashCount();
        renderDeletedNotes();
    }, 300);
}

function restoreAllNotes() {
    const notes = document.querySelectorAll('.deleted-note');
    notes.forEach((note, index) => {
        note.classList.add('removing');
        note.style.animation = 'noteDelete 0.2s ease-out forwards';
    });

    setTimeout(() => {
        while (deletedNotes.length > 0) {
            const note = deletedNotes[0];
            createNote(
                note.text,
                note.color,
                parsePosition(note.x),
                parsePosition(note.y),
                true,
                note.width,
                note.height,
                note.isBold  // Pass the bold state
            ).style.animation = 'paperPop 0.3s ease-out forwards';
            
            deletedNotes.splice(0, 1);
            saveActiveNotes();
        }
        saveDeletedNotes();
        updateTrashCount();
        toggleTrashModal();
    }, 300);

    updateBoardIndicators();
}

function clearTrash() {
    if (confirm('Are you sure you want to permanently delete all notes in the Bin?')) {
        const notes = document.querySelectorAll('.deleted-note');
        notes.forEach(note => {
            note.classList.add('removing');
        });
        
        // Wait for animation to complete before clearing
        setTimeout(() => {
            deletedNotes = [];
            saveDeletedNotes();
            updateTrashCount();
            renderDeletedNotes();
            toggleTrashModal(); // Close the modal
        }, 300);
    }
}

function updateTrashCount() {
    const countElement = document.querySelector('.trash-count');
    countElement.textContent = deletedNotes.length;
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('trashModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Check if modal is visible and click is on the backdrop
    if (modal.classList.contains('visible') && 
        e.target === modal) {  // Click is on the modal backdrop
        toggleTrashModal();
    }
});
// Event Listeners
document.addEventListener('click', (e) => {
    if (activePalette && !e.target.closest('.color-button')) {
        hideAllColorPalettes();
    }
});

document.querySelector('.note-input textarea').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        addNote();
    }
});

// Add a function to update add button state
function updateAddButtonState() {
    const addButton = document.querySelector('.add-board-button');
    if (boardCount >= MAX_BOARDS) {
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
        if (boardCount >= 2) {
            shortcutHint.style.display = 'block';
        } else {
            shortcutHint.style.display = 'none';
        }
    }
}

// Add these board style functions to the file
function toggleBoardStyleMenu() {
    const styleMenu = document.querySelector('.board-style-menu');
    
    if (!styleMenu.classList.contains('visible')) {
        // Prepare menu before showing
        setActiveStyle();
        setupStyleOptions();
        
        // Update pattern option buttons to match current board color
        const patternOptions = document.querySelectorAll('.board-pattern-option');
        patternOptions.forEach(option => {
            option.style.backgroundColor = boardStyles.colors.current;
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
        if (option.getAttribute('data-color') === boardStyles.colors.current) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
    
    // Set active pattern
    const patternOptions = document.querySelectorAll('.board-pattern-option');
    patternOptions.forEach(option => {
        if (option.getAttribute('data-pattern') === boardStyles.patterns.current) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

function changeBoardColor(color) {
    // Store current color
    boardStyles.colors.current = color;
    
    // Apply to active board
    const activeBoard = document.querySelector('.board.active');
    activeBoard.style.backgroundColor = color;
    
    // Save to localStorage
    saveBoardStyles();
    
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
    boardStyles.patterns.current = pattern;
    
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
    saveBoardStyles();
}

function saveBoardStyles() {
    // Save board styles to localStorage, specific to current board
    const boardStylesKey = `boardStyles_board_${currentBoardId}`;
    localStorage.setItem(boardStylesKey, JSON.stringify({
        color: boardStyles.colors.current,
        pattern: boardStyles.patterns.current
    }));
}

function loadBoardStyles(boardId) {
    // Load board styles from localStorage
    const boardStylesKey = `boardStyles_board_${boardId}`;
    const savedStyles = localStorage.getItem(boardStylesKey);
    
    if (savedStyles) {
        const styles = JSON.parse(savedStyles);
        boardStyles.colors.current = styles.color;
        boardStyles.patterns.current = styles.pattern;
        
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
    } else {
        // Reset to defaults
        boardStyles.colors.current = boardStyles.colors.default;
        boardStyles.patterns.current = boardStyles.patterns.default;
    }
    
    // Update board button styles to match
    updateBoardIndicators();
}

// Close board style menu when clicking outside
document.addEventListener('click', function(event) {
    const styleButton = document.querySelector('.board-style-button');
    const styleMenu = document.querySelector('.board-style-menu');
    
    if (styleMenu.classList.contains('visible') && 
        !styleButton.contains(event.target)) {
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
    for (let i = 1; i <= boardCount; i++) {
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
        const boardColor = boardElement.style.backgroundColor || '#1a1a1a';
        
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
        const rgb = hexToRgb(boardColor) || { r: 26, g: 26, b: 26 }; // default to #1a1a1a
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        
        // Use white text for dark backgrounds, black text for light backgrounds
        buttonElement.style.color = brightness > 128 ? '#000' : '#fff';
    }
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    // Handle rgba format
    if (hex.startsWith('rgba')) {
        const parts = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (parts) {
            return {
                r: parseInt(parts[1]),
                g: parseInt(parts[2]),
                b: parseInt(parts[3])
            };
        }
        return null;
    }
    
    // Handle hex format
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}