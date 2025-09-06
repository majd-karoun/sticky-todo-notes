// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load all saved data (notes, boards, styles, deleted notes)
    // This function is defined in components/utils.js
    // It internally calls functions like createNote, createBoardUI, loadBoardStyles, etc.
    loadNoteZIndexes();
    loadSavedData();

    // Setup event listeners for the main note input textarea
    // This function is defined in components/utils.js
    setupTextareaEvents();

    // Setup event listeners for board navigation (buttons, swipe, keyboard)
    // This function is defined in components/board.js
    setupBoardNavigation();

    // Setup event listeners for the board style menu options
    // This function is defined in components/board.js
    setupStyleOptions();

    // Setup event listeners for multi-note selection using a selection box
    // This function is defined in components/selection.js
    initBoardSelectionHandlers();

    // Set the initial shortcut icon (Cmd or Ctrl)
    // This function is defined in components/utils.js
    updateShortcutIcon();

    // Setup board title listeners
    // This function is defined in components/board.js
    setupBoardTitleListeners();
    
    // Show the board title temporarily for 3 seconds on page load
    setTimeout(() => showBoardTitleTemporarily(currentBoardId), 500);
    
    // Initialize board button animations
    initializeBoardButtonAnimations();

    // Add event listener for the board style button
    const styleButton = document.querySelector('.board-style-button');
    if (styleButton) {
        styleButton.addEventListener('click', toggleBoardStyleMenu); // toggleBoardStyleMenu is in components/board.js
    }

    // Add event listener for the trash bin icon
    const trashBin = document.querySelector('.trash-bin');
    if (trashBin) {
        trashBin.addEventListener('click', toggleTrashModal); // toggleTrashModal is in components/trash.js
    }

    // Add event listener for the close button in the trash modal
    const closeTrashButton = document.querySelector('#trashModal .close-modal-btn'); // Corrected selector
     if (closeTrashButton) {
        closeTrashButton.addEventListener('click', toggleTrashModal); // toggleTrashModal is in components/trash.js
    }

    // Add event listener for the restore all button in the trash modal
    const restoreAllButton = document.querySelector('#trashModal .restore-all-btn');
    if (restoreAllButton) {
        restoreAllButton.addEventListener('click', restoreAllNotes); // restoreAllNotes is in components/trash.js
    }

     // Add event listener for the clear trash button in the trash modal
    const clearTrashButton = document.querySelector('#trashModal .clear-trash-btn');
    if (clearTrashButton) {
        clearTrashButton.addEventListener('click', clearTrash); // clearTrash is in components/trash.js
    }

    // Setup first letter capitalization for inputs
    setupFirstLetterCapitalization();


});

// Function to capitalize only the first letter of text inputs
function setupFirstLetterCapitalization() {
    function capitalizeFirstLetter(input) {
        const cursorPosition = input.selectionStart;
        const value = input.value;
        
        if (value.length > 0) {
            const newValue = value.charAt(0).toUpperCase() + value.slice(1);
            if (newValue !== value) {
                input.value = newValue;
                input.setSelectionRange(cursorPosition, cursorPosition);
            }
        }
    }

    // Handle board title inputs for all boards (including dynamically created ones)
    function setupBoardTitleCapitalization(input) {
        input.addEventListener('input', function(e) {
            capitalizeFirstLetter(e.target);
        });
        input.addEventListener('keyup', function(e) {
            capitalizeFirstLetter(e.target);
        });
        input.addEventListener('paste', function(e) {
            setTimeout(() => capitalizeFirstLetter(e.target), 0);
        });
    }

    // Setup for existing board title inputs
    const boardTitleInputs = document.querySelectorAll('.board-title-input');
    boardTitleInputs.forEach(input => {
        setupBoardTitleCapitalization(input);
    });

    // Use MutationObserver to handle dynamically created board title inputs
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    // Check if the added node is a board or contains board title inputs
                    const newBoardTitleInputs = node.querySelectorAll ? node.querySelectorAll('.board-title-input') : [];
                    newBoardTitleInputs.forEach(input => {
                        setupBoardTitleCapitalization(input);
                    });
                    
                    // Also check if the node itself is a board title input
                    if (node.classList && node.classList.contains('board-title-input')) {
                        setupBoardTitleCapitalization(node);
                    }
                }
            });
        });
    });

    // Start observing the boards container for changes
    const boardsContainer = document.querySelector('.boards-container');
    if (boardsContainer) {
        observer.observe(boardsContainer, { childList: true, subtree: true });
    }

    // Handle note textarea
    const noteTextarea = document.querySelector('.note-input textarea');
    if (noteTextarea) {
        noteTextarea.addEventListener('input', function(e) {
            capitalizeFirstLetter(e.target);
        });
        noteTextarea.addEventListener('keyup', function(e) {
            capitalizeFirstLetter(e.target);
        });
        noteTextarea.addEventListener('paste', function(e) {
            setTimeout(() => capitalizeFirstLetter(e.target), 0);
        });
    }
}

// Function to initialize board button animations on page load
function initializeBoardButtonAnimations() {
    // Use setTimeout to ensure DOM is fully rendered and CSS is applied
    setTimeout(() => {
        const boardButtons = document.querySelectorAll('.board-button');
        boardButtons.forEach(button => {
            // Add the transitions-ready class to ensure proper CSS transitions
            button.classList.add('transitions-ready');
            
            // Trigger a reflow to ensure properties are applied
            button.offsetHeight;
            
            // Force another reflow after a brief moment to ensure transitions are ready
            requestAnimationFrame(() => {
                button.style.transform = 'scale(1)';
            });
        });
    }, 100);
}

