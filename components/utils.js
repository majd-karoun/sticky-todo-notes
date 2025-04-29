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

// Selection box variables
let isSelecting = false;
let selectionBox = null;
let selectionStartX = 0;
let selectionStartY = 0;
let selectedNotes = [];
let isMovingSelection = false;
let selectionMoveStartX = 0;
let selectionMoveStartY = 0;
let notesInitialPositions = [];

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
        switchToBoard(1); // Note: switchToBoard will be defined in board.js
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

// Save active notes to localStorage
function saveActiveNotes() {
    // Save notes for the current board
    const boardKey = `${ACTIVE_NOTES_KEY}_board_${currentBoardId}`;
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);

    if (!boardElement) return; // Board might not exist yet or was deleted

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
    updateBoardIndicators(); // Note: updateBoardIndicators will be defined in board.js
}

// Save deleted notes to localStorage.
function saveDeletedNotes() {
    localStorage.setItem(DELETED_NOTES_KEY, JSON.stringify(deletedNotes));
}

// Save board count to localStorage
function saveBoardCount() {
    localStorage.setItem(BOARDS_COUNT_KEY, boardCount.toString());
}

// Save board styles to localStorage
function saveBoardStyles() {
    // Save board styles to localStorage, specific to current board
    const boardStylesKey = `boardStyles_board_${currentBoardId}`;
    localStorage.setItem(boardStylesKey, JSON.stringify({
        color: boardStyles.colors.current,
        pattern: boardStyles.patterns.current
    }));
}

// Function to update shortcut icon based on OS
function updateShortcutIcon() {
    const shortcutIcon = document.getElementById('shortcutIcon');
    if (shortcutIcon) {
        // Check if user is on Mac or Windows
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? '⌘' : 'Ctrl';

        // Default focus hint
        shortcutIcon.innerHTML = `${modKey}`;
        shortcutIcon.classList.add('focus-hint');
        shortcutIcon.classList.remove('enter-hint');
    }
}



// Setup textarea focus/blur events
function setupTextareaEvents() {
    const textarea = document.querySelector('.note-input textarea');
    if (textarea) {

        
        textarea.addEventListener('focus', async function() {
            const shortcutIcon = document.getElementById('shortcutIcon');
            if (shortcutIcon) {
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                const modKey = isMac ? '⌘' : 'Ctrl';

                if (textarea.value.trim()) {
                    shortcutIcon.innerHTML = `${modKey}+↵`;
                    shortcutIcon.classList.remove('focus-hint');
                    shortcutIcon.classList.add('enter-hint');
                } else {
                    shortcutIcon.innerHTML = `${modKey}`;
                    shortcutIcon.classList.add('focus-hint');
                    shortcutIcon.classList.remove('enter-hint');
                }
            }

            // Animate the textarea to expand
            textarea.style.height = '50px';
            setTimeout(() => {
                textarea.style.height = '200px';
            }, 0);
            


            // Update shortcut icon when content changes
            const inputHandler = function() {
                if (shortcutIcon) {
                    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                    const modKey = isMac ? '⌘' : 'Ctrl';

                    if (textarea.value.trim()) {
                        shortcutIcon.innerHTML = `${modKey}+↵`;
                        shortcutIcon.classList.remove('focus-hint');
                        shortcutIcon.classList.add('enter-hint');
                    } else {
                        shortcutIcon.innerHTML = `${modKey}`;
                        shortcutIcon.classList.add('focus-hint');
                        shortcutIcon.classList.remove('enter-hint');
                    }
                }
            };

            textarea.addEventListener('input', inputHandler);
            textarea.addEventListener('blur', function() {
                textarea.removeEventListener('input', inputHandler);
            }, { once: true });
        });

        textarea.addEventListener('blur', function() {
            updateShortcutIcon();

            // Animate the textarea back to 50px tall
            textarea.style.height = '200px';
            setTimeout(() => {
                textarea.style.height = '50px';
            }, 0);
            

        });

        // Add global click handler to ensure textarea collapses when clicking elsewhere
        document.addEventListener('mousedown', function(e) {
            // If clicking outside the textarea and it's currently focused
            if (!e.target.closest('.note-input') && document.activeElement === textarea) {
                // Explicitly blur the textarea to trigger the blur event
                textarea.blur();
            }
        });
    }
}

// Load saved notes on startup
function loadSavedData() {
    // Check for mobile view
    checkMobileView();
    


    // Create selection box element
    createSelectionBox(); // Note: createSelectionBox will be defined in selection.js

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
            createBoardUI(i); // Note: createBoardUI will be defined in board.js
        }
    }

    // Update add button state
    updateAddButtonState(); // Note: updateAddButtonState will be defined in board.js

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

                createNote( // Note: createNote will be defined in note.js
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
        loadBoardStyles(i); // Note: loadBoardStyles will be defined in board.js
    }

    // Show the first board
    switchToBoard(1); // Note: switchToBoard will be defined in board.js

    // Load deleted notes
    const savedDeletedNotes = localStorage.getItem(DELETED_NOTES_KEY);
    if (savedDeletedNotes) {
        deletedNotes = JSON.parse(savedDeletedNotes);
        updateTrashCount(); // Note: updateTrashCount will be defined in trash.js
    }

    // Update indicators after loading notes
    updateBoardIndicators(); // Note: updateBoardIndicators will be defined in board.js

    // Update shortcut hint visibility
    updateShortcutHintVisibility(); // Note: updateShortcutHintVisibility will be defined in board.js
}
