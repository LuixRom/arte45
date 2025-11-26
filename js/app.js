/**
 * MAIN APP ORCHESTRATOR
 * Coordina las transiciones entre pantallas
 */

window.App = (function () {
    let resetButton = null;

    // Inicializar todos los módulos
    document.addEventListener('DOMContentLoaded', function () {
        CurtainScreen.init();
        WizardScreen.init();
        CameraScreen.init();

        // Crear botón de reinicio
        createResetButton();

        // Configurar flujo de transiciones
        setupFlow();

        // Mostrar pantalla inicial (cortinas)
        CurtainScreen.show();
    });

    function createResetButton() {
        resetButton = document.createElement('button');
        resetButton.className = 'reset-button';
        resetButton.textContent = 'Reiniciar';
        resetButton.setAttribute('aria-label', 'Reiniciar experiencia desde el inicio');
        resetButton.addEventListener('click', resetExperience);
        document.body.appendChild(resetButton);
    }

    function resetExperience() {
        // Confirmar antes de reiniciar
        if (confirm('¿Quieres reiniciar la experiencia desde el inicio?')) {
            goToCurtain();
        }
    }

    function goToCurtain() {
        // Ocultar todas las pantallas
        WizardScreen.hide();
        CameraScreen.hide();

        // Mostrar cortinas de nuevo
        CurtainScreen.show();

        // Reiniciar el estado de las cortinas (cerrarlas)
        const curtainContainer = document.querySelector('.curtain-container');
        if (curtainContainer) {
            curtainContainer.classList.remove('opening');
        }
    }

    function setupFlow() {
        // Cuando las cortinas se abren → mostrar wizard
        CurtainScreen.onOpen(() => {
            WizardScreen.show();
        });

        // Cuando el wizard se completa → mostrar cámara
        WizardScreen.onComplete((answers) => {
            console.log('Respuestas del usuario:', answers);
            // Aquí podrías guardar las respuestas si las necesitas después
            WizardScreen.hide();
            CameraScreen.show();
        });
    }

    // Exponer métodos públicos
    return {
        goToCurtain: goToCurtain
    };
})();
