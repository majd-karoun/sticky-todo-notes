// Emoji Sticker Management
let emojiStickers = {};
let draggedEmoji = null;
let dragOffset = { x: 0, y: 0 };
let emojiUsageOrder = [];

// Initialize emoji functionality
function initializeEmojiPicker() {
    loadEmojiUsageOrder();
    reorderEmojiPicker();
    
    const emojiItems = document.querySelectorAll('.emoji-item');
    emojiItems.forEach(item => {
        item.addEventListener('click', handleEmojiClick);
    });
    
    // Load existing emoji stickers for all boards
    loadAllEmojiStickers();
}

function handleEmojiClick(event) {
    const emoji = event.target.dataset.emoji;
    if (emoji) {
        updateEmojiUsageOrder(emoji);
        createEmojiSticker(emoji);
    }
}

function createEmojiSticker(emoji) {
    const activeBoard = document.querySelector('.board.active');
    if (!activeBoard) return;
    
    const boardId = activeBoard.dataset.boardId;
    
    // Check if emoji limit is reached
    if (getEmojiCount(boardId) >= 10) {
        showEmojiLimitMessage();
        return;
    }
    const stickerId = generateStickerId();
    
    // Create sticker element
    const stickerElement = document.createElement('div');
    stickerElement.className = 'emoji-sticker new';
    stickerElement.dataset.stickerId = stickerId;
    stickerElement.textContent = emoji;
    
    // Position sticker at random location on board, ignoring bottom 20%
    const boardRect = activeBoard.getBoundingClientRect();
    const maxX = boardRect.width - 120; // Account for emoji size
    const maxY = boardRect.height * 0.8 - 120; // Only use top 80% of the height
    const minY = 20; // Minimum Y position to avoid sticking to the very top
    const x = Math.random() * maxX;
    const y = Math.max(minY, Math.random() * maxY);
    
    stickerElement.style.left = x + 'px';
    stickerElement.style.top = y + 'px';
    
    // Create delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteEmojiSticker(stickerId, boardId);
    });
    
    
    stickerElement.appendChild(deleteButton);
    
    // Add drag functionality
    setupEmojiDrag(stickerElement);
    
    // Add to board
    activeBoard.appendChild(stickerElement);
    
    // Store sticker data
    if (!emojiStickers[boardId]) {
        emojiStickers[boardId] = {};
    }
    
    emojiStickers[boardId][stickerId] = {
        emoji: emoji,
        x: x,
        y: y,
        id: stickerId
    };
    
    // Save to localStorage
    saveEmojiStickers(boardId);
    
    // Remove 'new' class after animation
    setTimeout(() => {
        stickerElement.classList.remove('new');
    }, 400);
}

function setupEmojiDrag(stickerElement) {
    let isDragging = false;
    
    stickerElement.addEventListener('mousedown', startDrag);
    stickerElement.addEventListener('touchstart', startDrag, { passive: false });
    
    function startDrag(e) {
        if (e.target.classList.contains('delete-button')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        
        isDragging = true;
        draggedEmoji = stickerElement;
        
        // Disable text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.mozUserSelect = 'none';
        document.body.style.msUserSelect = 'none';
        document.onselectstart = () => false;
        document.ondragstart = () => false;
        
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        const rect = stickerElement.getBoundingClientRect();
        
        dragOffset.x = clientX - rect.left;
        dragOffset.y = clientY - rect.top;
        
        stickerElement.classList.add('dragging');
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }
    
    function drag(e) {
        if (!isDragging || !draggedEmoji) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const activeBoard = document.querySelector('.board.active');
        const boardRect = activeBoard.getBoundingClientRect();
        
        let x = clientX - boardRect.left - dragOffset.x;
        let y = clientY - boardRect.top - dragOffset.y;
        
        // Keep within board bounds
        x = Math.max(0, Math.min(x, boardRect.width - 120));
        y = Math.max(0, Math.min(y, boardRect.height - 120));
        
        draggedEmoji.style.left = x + 'px';
        draggedEmoji.style.top = y + 'px';
    }
    
    function stopDrag() {
        if (!isDragging || !draggedEmoji) return;
        
        isDragging = false;
        draggedEmoji.classList.remove('dragging');
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.mozUserSelect = '';
        document.body.style.msUserSelect = '';
        document.onselectstart = null;
        document.ondragstart = null;
        
        // Check bottom corner collision before saving position
        checkEmojiBottomCornerCollision(draggedEmoji);
        
        // Update stored position
        const boardId = document.querySelector('.board.active').dataset.boardId;
        const stickerId = draggedEmoji.dataset.stickerId;
        
        if (emojiStickers[boardId] && emojiStickers[boardId][stickerId]) {
            emojiStickers[boardId][stickerId].x = parseInt(draggedEmoji.style.left);
            emojiStickers[boardId][stickerId].y = parseInt(draggedEmoji.style.top);
            saveEmojiStickers(boardId);
        }
        
        draggedEmoji = null;
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    }
}

function deleteEmojiSticker(stickerId, boardId) {
    const stickerElement = document.querySelector(`[data-sticker-id="${stickerId}"]`);
    if (stickerElement) {
        // Add deleting class to trigger animation
        stickerElement.classList.add('deleting');
        
        // Remove the element after animation completes
        setTimeout(() => {
            stickerElement.remove();
        }, 500); // Match animation duration
    }
    
    if (emojiStickers[boardId]) {
        delete emojiStickers[boardId][stickerId];
        saveEmojiStickers(boardId);
    }
}


function saveEmojiStickers(boardId) {
    const key = `emojiStickers_board_${boardId}`;
    localStorage.setItem(key, JSON.stringify(emojiStickers[boardId] || {}));
}

function loadEmojiStickers(boardId) {
    const key = `emojiStickers_board_${boardId}`;
    const saved = localStorage.getItem(key);
    
    if (saved) {
        try {
            emojiStickers[boardId] = JSON.parse(saved);
            renderEmojiStickers(boardId);
        } catch (e) {
            console.error('Error loading emoji stickers:', e);
            emojiStickers[boardId] = {};
        }
    } else {
        emojiStickers[boardId] = {};
    }
}

function loadAllEmojiStickers() {
    for (let i = 1; i <= boardCount; i++) {
        loadEmojiStickers(i);
    }
}

function renderEmojiStickers(boardId) {
    const board = document.querySelector(`.board[data-board-id="${boardId}"]`);
    if (!board || !emojiStickers[boardId]) return;
    
    // Clear existing stickers
    board.querySelectorAll('.emoji-sticker').forEach(sticker => sticker.remove());
    
    // Render saved stickers
    Object.values(emojiStickers[boardId]).forEach(stickerData => {
        const stickerElement = document.createElement('div');
        stickerElement.className = 'emoji-sticker';
        stickerElement.dataset.stickerId = stickerData.id;
        stickerElement.textContent = stickerData.emoji;
        stickerElement.style.left = stickerData.x + 'px';
        stickerElement.style.top = stickerData.y + 'px';
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEmojiSticker(stickerData.id, boardId);
        });
        
        
        stickerElement.appendChild(deleteButton);
        
        // Add drag functionality
        setupEmojiDrag(stickerElement);
        
        board.appendChild(stickerElement);
    });
}

function updateEmojiUsageOrder(emoji) {
    // Add emoji to the beginning only if it's not already in the top 12
    const existingIndex = emojiUsageOrder.indexOf(emoji);
    if (existingIndex < 0 || existingIndex >= 12) {
        // Remove from current position if it exists
        if (existingIndex > -1) {
            emojiUsageOrder.splice(existingIndex, 1);
        }
        
        // Add emoji to the beginning of the array
        emojiUsageOrder.unshift(emoji);
        
        // Keep only the last 16 used emojis to prevent the array from growing too large
        if (emojiUsageOrder.length > 16) {
            emojiUsageOrder = emojiUsageOrder.slice(0, 16);
        }
        
        // Save to localStorage
        saveEmojiUsageOrder();
        
        // Reorder the picker
        reorderEmojiPicker();
    }
}

function loadEmojiUsageOrder() {
    const saved = localStorage.getItem('emojiUsageOrder');
    if (saved) {
        try {
            emojiUsageOrder = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading emoji usage order:', e);
            emojiUsageOrder = [];
        }
    } else {
        emojiUsageOrder = [];
    }
}

function saveEmojiUsageOrder() {
    localStorage.setItem('emojiUsageOrder', JSON.stringify(emojiUsageOrder));
}

function reorderEmojiPicker() {
    const emojiPicker = document.querySelector('.emoji-picker');
    if (!emojiPicker) return;
    
    // Get all original emoji items
    const allEmojiItems = Array.from(emojiPicker.querySelectorAll('.emoji-item:not(.recent-emoji)'));
    
    // Remove any existing recent emojis
    emojiPicker.querySelectorAll('.recent-emoji').forEach(item => item.remove());
    
    // Add recent emojis at the beginning if we have any
    if (emojiUsageOrder.length > 0) {
        const recentEmojis = emojiUsageOrder.slice(0, 12); // Limit to 12 recent emojis (3 full rows)
        
        // Insert recent emojis at the beginning
        recentEmojis.reverse().forEach(emoji => {
            const emojiElement = document.createElement('div');
            emojiElement.className = 'emoji-item recent-emoji';
            emojiElement.dataset.emoji = emoji;
            emojiElement.textContent = emoji;
            emojiElement.addEventListener('click', handleEmojiClick);
            emojiPicker.insertBefore(emojiElement, emojiPicker.firstChild);
        });
    }
}


function getEmojiCount(boardId) {
    if (!emojiStickers[boardId]) return 0;
    return Object.keys(emojiStickers[boardId]).length;
}

function showEmojiLimitMessage() {
    const emojiLimitMessage = document.getElementById('emojiLimitMessage');
    if (emojiLimitMessage) {
        emojiLimitMessage.classList.add('visible');
        setTimeout(() => {
            emojiLimitMessage.classList.remove('visible');
        }, 1500); // Show for 3 seconds
    }
}

function checkEmojiBottomCornerCollision(emoji) {
    if (!emoji) return;
    const emojiRect = emoji.getBoundingClientRect();
    const screenHeight = window.innerHeight;
    const restrictedWidth = 250, restrictedHeight = 150;
    const restrictedTop = screenHeight - restrictedHeight;

    const overlapsVertically = emojiRect.bottom > restrictedTop;
    const overlapsBottomLeft = emojiRect.left < restrictedWidth && overlapsVertically;

    if (overlapsBottomLeft) {
        const moveUpDistance = emojiRect.bottom - restrictedTop + 20;
        const activeBoard = document.querySelector('.board.active');
        const boardRect = activeBoard.getBoundingClientRect();
        const currentTop = parseInt(emoji.style.top);
        const newTop = Math.max(60, currentTop - moveUpDistance);
        emoji.style.transition = 'top 0.3s ease-out';
        emoji.style.top = `${newTop}px`;
        setTimeout(() => emoji.style.transition = '', 300);
    }
}

function generateStickerId() {
    return 'emoji_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Clean up emoji stickers when board is deleted
function cleanupEmojiStickers(boardId) {
    const key = `emojiStickers_board_${boardId}`;
    localStorage.removeItem(key);
    delete emojiStickers[boardId];
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other components to initialize
    setTimeout(initializeEmojiPicker, 100);
});

// Export functions for use in other components
window.emojiStickers = {
    loadEmojiStickers,
    renderEmojiStickers,
    cleanupEmojiStickers,
    initializeEmojiPicker
};

