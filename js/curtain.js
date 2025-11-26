
const CurtainScreen = (function () {
    let container = null;
    let onOpenCallback = null;

    function init() {
        container = document.getElementById('curtain-screen');
        if (!container) {
            console.error('Curtain screen container not found');
            return;
        }

        const startBtn = container.querySelector('#curtain-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', openCurtains);
        }
    }

    function show() {
        if (container) {
            container.classList.add('active');
        }
    }

    function hide() {
        if (container) {
            container.classList.remove('active');
        }
    }

    function openCurtains() {
        const curtainContainer = container.querySelector('.curtain-container');
        if (!curtainContainer) return;

        curtainContainer.classList.add('opening');

        setTimeout(() => {
            hide();
            if (onOpenCallback) {
                onOpenCallback();
            }
        }, 1800);
    }

    function onOpen(callback) {
        onOpenCallback = callback;
    }

    return {
        init,
        show,
        hide,
        onOpen
    };
})();
