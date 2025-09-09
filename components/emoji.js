/**
 * EMOJI STICKER MODULE
 * Handles emoji sticker functionality including:
 * - Emoji picker and sticker creation
 * - Drag and drop positioning
 * - Usage tracking and reordering
 * - Board-specific sticker management
 * - Collision detection and limits
 */

// Global state for emoji sticker management
let emojiStickers = {}, draggedEmoji = null, dragOffset = { x: 0, y: 0 }, emojiUsageOrder = [];

/**
 * Initializes the emoji picker system
 * Loads usage history, reorders picker, and sets up event handlers
 */
function initializeEmojiPicker() {
    [loadEmojiUsageOrder(), reorderEmojiPicker(), loadAllEmojiStickers()];
    $$('.emoji-item').forEach(item => {
        item.addEventListener('click', handleEmojiClick);
    });
}

/**
 * Handles clicks on emoji picker items
 * Updates usage order and creates new sticker
 * @param {Event} event - The click event
 */
const handleEmojiClick = event => {
    const emoji = event.target.dataset.emoji;
    emoji && [updateEmojiUsageOrder(emoji), createEmojiSticker(emoji)];
};

/**
 * Creates a new emoji sticker on the active board
 * Handles positioning, limits, and DOM creation
 * @param {string} emoji - The emoji character to create
 */
function createEmojiSticker(emoji) {
    const activeBoard = $('.board.active');
    if (!activeBoard) return;
    
    const boardId = activeBoard.dataset.boardId;
    if (getEmojiCount(boardId) >= 10) return showEmojiLimitMessage();
    
    const stickerId = generateStickerId(), boardRect = activeBoard.getBoundingClientRect();
    const [maxX, maxY, minY] = [boardRect.width - 120, boardRect.height * 0.8 - 120, 20];
    const [x, y] = [Math.random() * maxX, Math.max(minY, Math.random() * maxY)];
    
    const stickerElement = Object.assign(document.createElement('div'), {
        className: 'emoji-sticker new',
        textContent: emoji
    });
    stickerElement.dataset.stickerId = stickerId;
    Object.assign(stickerElement.style, { left: x + 'px', top: y + 'px' });
    
    const deleteButton = Object.assign(document.createElement('button'), {
        className: 'delete-button',
        textContent: '×'
    });
    deleteButton.addEventListener('click', e => [e.stopPropagation(), deleteEmojiSticker(stickerId, boardId)]);
    
    [stickerElement.appendChild(deleteButton), setupEmojiDrag(stickerElement), activeBoard.appendChild(stickerElement)];
    
    (emojiStickers[boardId] = emojiStickers[boardId] || {})[stickerId] = { emoji, x, y, id: stickerId };
    [saveEmojiStickers(boardId), setTimeout(() => stickerElement.classList.remove('new'), 400)];
}

/**
 * Sets up drag and drop functionality for an emoji sticker
 * Handles mouse events with boundary constraints
 * @param {Element} stickerElement - The sticker element to make draggable
 */
function setupEmojiDrag(stickerElement) {
    let isDragging = false;
    stickerElement.addEventListener('mousedown', startDrag);
    
    function startDrag(e) {
        if (e.target.classList.contains('delete-button')) return;
        [e.preventDefault(), e.stopPropagation()];
        
        [isDragging, draggedEmoji] = [true, stickerElement];
        
        // Disable text selection during drag
        Object.assign(document.body.style, { userSelect: 'none', webkitUserSelect: 'none', mozUserSelect: 'none', msUserSelect: 'none' });
        [document.onselectstart, document.ondragstart] = [() => false, () => false];
        
        const [clientX, clientY] = [e.clientX, e.clientY];
        const rect = stickerElement.getBoundingClientRect();
        [dragOffset.x, dragOffset.y] = [clientX - rect.left, clientY - rect.top];
        
        stickerElement.classList.add('dragging');
        // Register global drag handlers
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    function drag(e) {
        if (!isDragging || !draggedEmoji) return;
        [e.preventDefault(), e.stopPropagation()];
        
        const [clientX, clientY] = [e.clientX, e.clientY];
        const boardRect = $('.board.active').getBoundingClientRect();
        
        const [x, y] = [
            Math.max(0, Math.min(clientX - boardRect.left - dragOffset.x, boardRect.width - 120)),
            Math.max(0, Math.min(clientY - boardRect.top - dragOffset.y, boardRect.height - 120))
        ];
        // Use animation batcher for smooth positioning
        if (window.AnimationUtils) {
            window.AnimationUtils.updatePosition(draggedEmoji, x, y);
        } else {
            Object.assign(draggedEmoji.style, { left: x + 'px', top: y + 'px' });
        }
    }
    
    function stopDrag() {
        if (!isDragging || !draggedEmoji) return;
        
        [isDragging, draggedEmoji.classList.remove('dragging')];
        Object.assign(document.body.style, { userSelect: '', webkitUserSelect: '', mozUserSelect: '', msUserSelect: '' });
        [document.onselectstart, document.ondragstart] = [null, null];
        
        checkEmojiBottomCornerCollision(draggedEmoji);
        
        const [boardId, stickerId] = [$('.board.active').dataset.boardId, draggedEmoji.dataset.stickerId];
        if (emojiStickers[boardId]?.[stickerId]) {
            Object.assign(emojiStickers[boardId][stickerId], {
                x: parseInt(draggedEmoji.style.left),
                y: parseInt(draggedEmoji.style.top)
            });
            saveEmojiStickers(boardId);
        }
        
        draggedEmoji = null;
        // Unregister global drag handlers
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

const deleteEmojiSticker = (stickerId, boardId) => {
    const stickerElement = $(`[data-sticker-id="${stickerId}"]`);
    stickerElement && [stickerElement.classList.add('deleting'), setTimeout(() => stickerElement.remove(), 500)];
    emojiStickers[boardId] && [delete emojiStickers[boardId][stickerId], saveEmojiStickers(boardId)];
};

const saveEmojiStickers = boardId => {
    window.DebouncedStorage.save(`emojiStickers_board_${boardId}`, emojiStickers[boardId] || {});
};

function loadEmojiStickers(boardId) {
    const saved = localStorage.getItem(`emojiStickers_board_${boardId}`);
    try {
        emojiStickers[boardId] = saved ? JSON.parse(saved) : {};
        saved && renderEmojiStickers(boardId);
    } catch (e) {
        [console.error('Error loading emoji stickers:', e), emojiStickers[boardId] = {}];
    }
}

const loadAllEmojiStickers = () => Array.from({length: boardCount}, (_, i) => loadEmojiStickers(i + 1));

function renderEmojiStickers(boardId) {
    const board = $(`.board[data-board-id="${boardId}"]`);
    if (!board || !emojiStickers[boardId]) return;
    
    Array.from(board.querySelectorAll('.emoji-sticker')).forEach(sticker => sticker.remove());
    
    Object.values(emojiStickers[boardId]).forEach(({id, emoji, x, y}) => {
        const stickerElement = Object.assign(document.createElement('div'), {
            className: 'emoji-sticker',
            textContent: emoji
        });
        stickerElement.dataset.stickerId = id;
        if (window.AnimationUtils) {
            window.AnimationUtils.updatePosition(stickerElement, x, y);
        } else {
            Object.assign(stickerElement.style, { left: x + 'px', top: y + 'px' });
        }
        
        const deleteButton = Object.assign(document.createElement('button'), {
            className: 'delete-button',
            textContent: '×'
        });
        deleteButton.addEventListener('click', e => [e.stopPropagation(), deleteEmojiSticker(id, boardId)]);
        
        [stickerElement.appendChild(deleteButton), setupEmojiDrag(stickerElement), board.appendChild(stickerElement)];
    });
}

function updateEmojiUsageOrder(emoji) {
    const existingIndex = emojiUsageOrder.indexOf(emoji);
    if (existingIndex < 0 || existingIndex >= 12) {
        existingIndex > -1 && emojiUsageOrder.splice(existingIndex, 1);
        emojiUsageOrder.unshift(emoji);
        emojiUsageOrder.length > 16 && (emojiUsageOrder = emojiUsageOrder.slice(0, 16));
        [saveEmojiUsageOrder(), reorderEmojiPicker()];
    }
}

function loadEmojiUsageOrder() {
    const saved = localStorage.getItem('emojiUsageOrder');
    try {
        emojiUsageOrder = saved ? JSON.parse(saved) : [];
    } catch (e) {
        [console.error('Error loading emoji usage order:', e), emojiUsageOrder = []];
    }
}

const saveEmojiUsageOrder = () => localStorage.setItem('emojiUsageOrder', JSON.stringify(emojiUsageOrder));

function reorderEmojiPicker() {
    const emojiPicker = $('.emoji-picker');
    if (!emojiPicker) return;
    
    Array.from(emojiPicker.querySelectorAll('.recent-emoji')).forEach(item => item.remove());
    
    emojiUsageOrder.length > 0 && emojiUsageOrder.slice(0, 12).reverse().forEach(emoji => {
        const emojiElement = Object.assign(document.createElement('div'), {
            className: 'emoji-item recent-emoji',
            textContent: emoji
        });
        emojiElement.dataset.emoji = emoji;
        emojiElement.addEventListener('click', handleEmojiClick);
        emojiPicker.insertBefore(emojiElement, emojiPicker.firstChild);
    });
}

const getEmojiCount = boardId => emojiStickers[boardId] ? Object.keys(emojiStickers[boardId]).length : 0;

const showEmojiLimitMessage = () => {
    const emojiLimitMessage = document.getElementById('emojiLimitMessage');
    emojiLimitMessage && [emojiLimitMessage.classList.add('visible'), setTimeout(() => emojiLimitMessage.classList.remove('visible'), 1000)];
};

function checkEmojiBottomCornerCollision(emoji) {
    if (!emoji) return;
    const [emojiRect, screenHeight] = [emoji.getBoundingClientRect(), window.innerHeight];
    const [restrictedWidth, restrictedHeight, restrictedTop] = [250, 150, screenHeight - 150];
    
    const overlapsBottomLeft = emojiRect.left < restrictedWidth && emojiRect.bottom > restrictedTop;
    if (overlapsBottomLeft) {
        const newTop = Math.max(60, parseInt(emoji.style.top) - (emojiRect.bottom - restrictedTop + 20));
        emoji.style.top = `${newTop}px`;
    }
}

const generateStickerId = () => 'emoji_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const cleanupEmojiStickers = boardId => [localStorage.removeItem(`emojiStickers_board_${boardId}`), delete emojiStickers[boardId]];

document.addEventListener('DOMContentLoaded', () => setTimeout(initializeEmojiPicker, 100));

window.emojiStickers = { loadEmojiStickers, renderEmojiStickers, cleanupEmojiStickers, initializeEmojiPicker };

