// Global Variables
const colors = ['#f0e68c', '#98ff98', '#ff7eb9', '#7afcff', '#FE8801', '#ec0c39', '#AF65EF', '#ffd700', '#C1C1C1', '#FFFFFF'];
const boardStyles = {
    colors: { default: '#1a1a1a', current: '#1a1a1a' },
    patterns: { default: 'none', current: 'none' }
};
let deletedNotes = [];
let holdTimer, activeNote = null, activePalette = null;
let isSelecting = false, selectionBox = null, selectionStartX = 0, selectionStartY = 0;
let selectedNotes = [], isMovingSelection = false, selectionMoveStartX = 0, selectionMoveStartY = 0;
let notesInitialPositions = [];
const lastNotePositions = {}, lastNoteColors = {};
lastNotePositions[1] = { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 75 };
lastNoteColors[1] = colors[0];
let currentBoardId = 1, boardCount = 1, isMobileView = false;
const MAX_BOARDS = 9;
const ACTIVE_NOTES_KEY = 'stickyNotes_active', DELETED_NOTES_KEY = 'stickyNotes_deleted', BOARDS_COUNT_KEY = 'stickyNotes_boardCount';

function checkMobileView() {
    isMobileView = window.innerWidth <= 768;
    if (isMobileView && currentBoardId !== 1 && typeof switchToBoard === 'function') switchToBoard(1);
}

function parsePosition(value) {
    return parseInt(String(value).replace('px', '')) || 0;
}

function getNextNotePosition(lastX, lastY) {
    const horizontalOffset = Math.random() * 10 - 5;
    let newX = lastX + horizontalOffset, newY = lastY + 55;
    const padding = 5, maxX = window.innerWidth - 150, maxY = window.innerHeight - 100;
    if (newY > maxY) { newY = padding; newX = padding + Math.random() * (maxX - padding); }
    newX = Math.min(Math.max(newX, -padding), maxX);
    newY = Math.min(Math.max(newY, -padding), maxY);
    return { x: newX, y: newY };
}

function hexToRgb(hex) {
    if (hex.startsWith('rgba')) {
        const parts = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return parts ? { r: parseInt(parts[1]), g: parseInt(parts[2]), b: parseInt(parts[3]) } : null;
    }
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function saveActiveNotes() {
    const boardElement = document.querySelector(`.board[data-board-id="${currentBoardId}"]`);
    if (!boardElement) return;
    const notesData = Array.from(boardElement.querySelectorAll('.sticky-note')).map(note => ({
        text: note.querySelector('.sticky-content').innerHTML,
        color: note.style.backgroundColor,
        x: note.style.left, y: note.style.top,
        width: note.style.width || '200px', height: note.style.height || '150px',
        isBold: note.querySelector('.sticky-content').classList.contains('bold')
    }));
    saveToLocalStorage(`${ACTIVE_NOTES_KEY}_board_${currentBoardId}`, notesData);
    if (typeof updateBoardIndicators === 'function') updateBoardIndicators();
}
function saveDeletedNotes() { saveToLocalStorage(DELETED_NOTES_KEY, deletedNotes); }
function saveBoardCount() { localStorage.setItem(BOARDS_COUNT_KEY, boardCount.toString()); }
function saveBoardStyles() {
    saveToLocalStorage(`boardStyles_board_${currentBoardId}`, {
        color: boardStyles.colors.current,
        pattern: boardStyles.patterns.current
    });
}

function updateShortcutIconDisplay() { // Renamed for clarity
    const shortcutIconEl = document.getElementById('shortcutIcon');
    if (shortcutIconEl) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? '⌘' : 'Ctrl';
        shortcutIconEl.innerHTML = modKey;
        shortcutIconEl.className = 'shortcut-icon focus-hint'; // Default state
    }
}

function setupTextareaEvents() {
    const textarea = document.querySelector('.note-input textarea');
    if (!textarea) return;
    const shortcutIconEl = document.getElementById('shortcutIcon');

    const updateHint = () => {
        if (shortcutIconEl) {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modKey = isMac ? '⌘' : 'Ctrl';
            const hasText = textarea.value.trim();
            shortcutIconEl.innerHTML = hasText ? `${modKey}+↵` : modKey;
            shortcutIconEl.classList.toggle('focus-hint', !hasText);
            shortcutIconEl.classList.toggle('enter-hint', hasText);
        }
    };

    textarea.addEventListener('focus', () => {
        updateHint();
        textarea.style.height = '50px'; // Start small
        requestAnimationFrame(() => textarea.style.height = '200px'); // Expand
        textarea.addEventListener('input', updateHint);
    });
    textarea.addEventListener('blur', () => {
        updateShortcutIconDisplay(); // Reset to default
        textarea.style.height = '200px'; // Start big
        requestAnimationFrame(() => textarea.style.height = '50px'); // Contract
        textarea.removeEventListener('input', updateHint);
    });
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.note-input') && document.activeElement === textarea) textarea.blur();
    });
}

function loadSavedData() {
    checkMobileView();
    if (typeof createSelectionBox === 'function') createSelectionBox();

    const savedBoardCount = localStorage.getItem(BOARDS_COUNT_KEY);
    if (savedBoardCount) {
        boardCount = Math.min(parseInt(savedBoardCount), MAX_BOARDS);
        if (boardCount > MAX_BOARDS) saveBoardCount(); // Correct if over max
        for (let i = 2; i <= boardCount; i++) {
            if (typeof createBoardUI === 'function') createBoardUI(i);
        }
    }
    if (typeof updateAddButtonState === 'function') updateAddButtonState();

    for (let i = 1; i <= boardCount; i++) {
        const savedBoardNotes = localStorage.getItem(`${ACTIVE_NOTES_KEY}_board_${i}`);
        if (savedBoardNotes) {
            JSON.parse(savedBoardNotes).forEach(note => {
                lastNotePositions[i] = { x: parsePosition(note.x), y: parsePosition(note.y) };
                lastNoteColors[i] = note.color;
                if (typeof createNote === 'function') createNote(note.text, note.color, parsePosition(note.x), parsePosition(note.y), true, note.width, note.height, note.isBold, i);
            });
        }
        if (typeof loadBoardStyles === 'function') loadBoardStyles(i);
    }
    if (typeof switchToBoard === 'function') switchToBoard(1);

    const savedDeleted = localStorage.getItem(DELETED_NOTES_KEY);
    if (savedDeleted) {
        deletedNotes = JSON.parse(savedDeleted);
        if (typeof updateTrashCount === 'function') updateTrashCount();
    }
    if (typeof updateBoardIndicators === 'function') updateBoardIndicators();
    if (typeof updateShortcutHintVisibility === 'function') updateShortcutHintVisibility();
    updateShortcutIconDisplay(); // Initialize shortcut icon display
    setupTextareaEvents(); // Initialize textarea events
}