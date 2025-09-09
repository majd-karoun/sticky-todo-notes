// Utility function to add event listeners with null checks
function addEventListeners(selectors) {
    selectors.forEach(({selector, event, handler}) => {
        const element = $(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    });
}

// Initialize the application when DOM is loaded
const domContentLoadedHandler = function() {
    // Load data and setup core functionality
    loadNoteZIndexes();
    loadSavedData();
    setupTextareaEvents();
    setupBoardNavigation();
    setupStyleOptions();
    initBoardSelectionHandlers();
    updateShortcutIcon();
    setupBoardTitleListeners();
    setupFirstLetterCapitalization();
    
    // Initialize UI elements
    setTimeout(() => showBoardTitleTemporarily(currentBoardId), 500);
    initializeBoardButtonAnimations();

    // Setup event listeners for UI controls
    addEventListeners([
        {selector: '.board-style-button', event: 'click', handler: toggleBoardStyleMenu},
        {selector: '.trash-bin', event: 'click', handler: toggleTrashModal},
        {selector: '#trashModal .close-modal-btn', event: 'click', handler: toggleTrashModal},
        {selector: '#trashModal .clear-trash-btn', event: 'click', handler: clearTrash}
    ]);
};

document.addEventListener('DOMContentLoaded', domContentLoadedHandler);

// Function to capitalize only the first letter of text inputs
function setupFirstLetterCapitalization() {
    const capitalizeFirstLetter = (input) => {
        const cursorPosition = input.selectionStart;
        const value = input.value;
        if (value.length > 0) {
            const newValue = value.charAt(0).toUpperCase() + value.slice(1);
            if (newValue !== value) {
                input.value = newValue;
                input.setSelectionRange(cursorPosition, cursorPosition);
            }
        }
    };

    const setupInputCapitalization = (input) => {
        ['input', 'keyup'].forEach(event => {
            input.addEventListener(event, e => capitalizeFirstLetter(e.target));
        });
        
        const pasteHandler = e => setTimeout(() => capitalizeFirstLetter(e.target), 0);
        input.addEventListener('paste', pasteHandler);
    };

    // Setup existing inputs
    $$('.board-title-input, .note-input textarea')
        .forEach(setupInputCapitalization);

    // Observer for dynamic inputs
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    const inputs = node.querySelectorAll ? Array.from(node.querySelectorAll('.board-title-input')) : [];
                    inputs.forEach(setupInputCapitalization);
                    if (node.classList?.contains('board-title-input')) {
                        setupInputCapitalization(node);
                    }
                }
            });
        });
    });

    const boardsContainer = $('.boards-container');
    if (boardsContainer) {
        observer.observe(boardsContainer, { childList: true, subtree: true });
    }
}

// Function to initialize board button animations on page load
function initializeBoardButtonAnimations() {
    setTimeout(() => {
        $$('.board-button').forEach(button => {
            button.classList.add('transitions-ready');
            button.offsetHeight; // Trigger reflow
            requestAnimationFrame(() => {
                if (window.AnimationUtils) {
                    window.AnimationUtils.updateStyles(button, { transform: 'scale(1)' }, 'normal');
                } else {
                    button.style.transform = 'scale(1)';
                }
            });
        });
    }, 100);
}

// Expose functions globally for onclick attributes
window.toggleBold = toggleBold;
window.markAsDone = markAsDone;
