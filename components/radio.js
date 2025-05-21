// Radio control animations
function initRadioControls() {
    const prevButton = document.querySelector('.prev-station');
    const nextButton = document.querySelector('.next-station');
    const radioToggle = document.querySelector('.radio-toggle');

    function showRadioControl(button) {
        button.classList.add('show');
        button.classList.remove('hide');
    }

    function hideRadioControl(button) {
        button.classList.add('hide');
        button.classList.remove('show');
    }

    // Show radio controls when radio is on
    radioToggle.addEventListener('change', () => {
        if (radioToggle.checked) {
            showRadioControl(prevButton);
            showRadioControl(nextButton);
        } else {
            hideRadioControl(prevButton);
            hideRadioControl(nextButton);
        }
    });

    // Initialize controls based on initial state
    if (radioToggle.checked) {
        showRadioControl(prevButton);
        showRadioControl(nextButton);
    }
}

// Initialize radio controls when DOM is loaded
document.addEventListener('DOMContentLoaded', initRadioControls);
