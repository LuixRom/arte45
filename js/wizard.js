const WizardScreen = (function () {
    let container = null;
    let currentQuestionIndex = 0;
    let answers = {};
    let onCompleteCallback = null;

    const questions = [
        {
            id: 'q1',
            text: '¿Esta emoción se siente más como una reacción del momento o algo que vienes cargando desde antes?',
            type: 'radio',
            options: [
                'Una reacción del momento',
                'Algo que vengo cargando desde antes'
            ]
        },
        {
            id: 'q2',
            text: 'Si tu emoción tuviera un color, ¿cuál sería y por qué?',
            type: 'color-text',
            placeholder: 'Describe por qué elegiste ese color...'
        },
        {
            id: 'q3',
            text: '¿Esta sensación te impulsa a moverte o te invita a detenerte?',
            type: 'radio',
            options: [
                'Me impulsa a moverme',
                'Me invita a detenerme',
                'Un poco de ambas'
            ]
        },
        {
            id: 'q4',
            text: '¿Sientes que esta emoción quiere decirte algo importante? ¿Qué crees que es?',
            type: 'textarea',
            placeholder: 'Escribe lo que sientes que esta emoción te está comunicando...'
        },
        {
            id: 'q5',
            text: '¿Esta emoción nace por un hecho real o por una interpretación que estás haciendo del momento?',
            type: 'radio',
            options: [
                'Por un hecho real',
                'Por mi interpretación del momento',
                'Una mezcla de ambos'
            ]
        }
    ];

    function init() {
        container = document.getElementById('wizard-screen');
        if (!container) {
            console.error('Wizard screen container not found');
            return;
        }

        renderQuestion();
        setupNavigation();
    }

    function show() {
        if (container) {
            container.classList.add('active');
            currentQuestionIndex = 0;
            answers = {};
            renderQuestion();
        }
    }

    function hide() {
        if (container) {
            container.classList.remove('active');
        }
    }

    function renderQuestion() {
        const question = questions[currentQuestionIndex];
        const questionContainer = container.querySelector('#wizard-question-container');
        const progressText = container.querySelector('#wizard-progress-text');
        const progressBar = container.querySelector('#wizard-progress-bar');
        const nextBtn = container.querySelector('#wizard-next-btn');

        if (!questionContainer) return;

        // Actualizar progreso
        if (progressText) {
            progressText.textContent = `Pregunta ${currentQuestionIndex + 1} de ${questions.length}`;
        }
        if (progressBar) {
            const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
            progressBar.style.width = `${progress}%`;
        }

        // Animación de salida
        questionContainer.classList.add('exiting');

        setTimeout(() => {
            // Renderizar nueva pregunta
            questionContainer.innerHTML = renderQuestionHTML(question);
            questionContainer.classList.remove('exiting');
            questionContainer.classList.add('active');

            // Deshabilitar botón siguiente
            if (nextBtn) {
                nextBtn.disabled = true;
            }

            // Agregar listeners a los inputs
            setupQuestionListeners(question);
        }, 400);
    }

    function renderQuestionHTML(question) {
        let inputHTML = '';

        if (question.type === 'radio') {
            inputHTML = `
        <div class="radio-group">
          ${question.options.map((option, index) => `
            <div class="radio-option">
              <input type="radio" id="${question.id}-${index}" name="${question.id}" value="${option}">
              <label for="${question.id}-${index}" class="radio-label">${option}</label>
            </div>
          `).join('')}
        </div>
      `;
        } else if (question.type === 'textarea') {
            inputHTML = `
        <textarea 
          id="${question.id}" 
          class="textarea-input" 
          placeholder="${question.placeholder || ''}"
          rows="5"
        ></textarea>
      `;
        } else if (question.type === 'color-text') {
            inputHTML = `
        <div class="color-input-group">
          <div class="color-picker-wrapper">
            <label class="color-picker-label">Color</label>
            <input type="color" id="${question.id}-color" class="color-input" value="#FFD700">
          </div>
          <div class="color-text-input">
            <textarea 
              id="${question.id}-text" 
              class="textarea-input" 
              placeholder="${question.placeholder || ''}"
              rows="4"
            ></textarea>
          </div>
        </div>
      `;
        }

        return `
      <h3 class="question-text">${question.text}</h3>
      <div class="question-input">
        ${inputHTML}
      </div>
    `;
    }

    function setupQuestionListeners(question) {
        const nextBtn = container.querySelector('#wizard-next-btn');

        if (question.type === 'radio') {
            const radios = container.querySelectorAll(`input[name="${question.id}"]`);
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    answers[question.id] = e.target.value;
                    if (nextBtn) nextBtn.disabled = false;
                });
            });
        } else if (question.type === 'textarea') {
            const textarea = container.querySelector(`#${question.id}`);
            if (textarea) {
                textarea.addEventListener('input', (e) => {
                    const value = e.target.value.trim();
                    answers[question.id] = value;
                    if (nextBtn) nextBtn.disabled = value.length === 0;
                });
            }
        } else if (question.type === 'color-text') {
            const colorInput = container.querySelector(`#${question.id}-color`);
            const textInput = container.querySelector(`#${question.id}-text`);

            const checkBothFilled = () => {
                const color = colorInput ? colorInput.value : '';
                const text = textInput ? textInput.value.trim() : '';
                answers[question.id] = { color, text };
                if (nextBtn) nextBtn.disabled = text.length === 0;
            };

            if (colorInput) colorInput.addEventListener('change', checkBothFilled);
            if (textInput) textInput.addEventListener('input', checkBothFilled);
        }
    }

    function setupNavigation() {
        const nextBtn = container.querySelector('#wizard-next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', handleNext);
        }
    }

    function handleNext() {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        } else {
            // Completado
            if (onCompleteCallback) {
                onCompleteCallback(answers);
            }
        }
    }

    function onComplete(callback) {
        onCompleteCallback = callback;
    }

    return {
        init,
        show,
        hide,
        onComplete
    };
})();
