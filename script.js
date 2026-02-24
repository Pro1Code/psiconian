// ===== CONFIGURACIÓN =====
const API_BASE_URL = '';  // Vacío para rutas relativas

// ===== ESTADO DE USUARIO =====
let currentUser = null;

// Detectar en qué página estamos
const isDashboard = window.location.pathname.includes('dashboard.html');

// ===== FUNCIONES DE API =====
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Error en la petición');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ===== VERIFICAR SESIÓN =====
async function verifySession() {
    try {
        const result = await apiRequest('/api/verify_session');
        if (result.valid) {
            currentUser = result.user;
            return true;
        }
    } catch (error) {
        console.log('No hay sesión activa');
    }
    return false;
}

// ===== CARGAR USUARIO AL INICIAR =====
async function loadUserFromStorage() {
    const sessionValid = await verifySession();

    if (sessionValid) {
        if (isDashboard) {
            updateDashboardUI();
        } else {
            updateUIForLoggedUser();
        }
    } else {
        if (isDashboard) {
            window.location.href = 'index.html';
        }
    }
}

// ===== FUNCIONES DE UI =====
function updateDashboardUI() {
    if (!currentUser) return;

    document.getElementById('userNameDisplay').textContent = currentUser.name || 'Usuario';
    document.getElementById('userGreeting').textContent = `Hola, ${currentUser.name || 'Usuario'}`;

    // NOTA: El enlace admin ahora es visible para todos (lo manejamos en el HTML directamente)
    // El backend se encargará de proteger la ruta /admin

    loadUserProgress();
}
function updateUIForLoggedUser() {
    if (!currentUser) return;

    const navZonaPersonal = document.getElementById('navZonaPersonal');
    const premiumContent = document.getElementById('premiumContent');
    const zonaPersonal = document.getElementById('zona-personal');

    if (navZonaPersonal) navZonaPersonal.style.display = 'inline-block';
    if (premiumContent) premiumContent.style.display = 'block';
    if (zonaPersonal) zonaPersonal.style.display = 'block';

    const userNameDisplay = document.getElementById('userNameDisplay');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    if (userNameDisplay) userNameDisplay.textContent = currentUser.name || 'Usuario';
    if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;

    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    const userLoggedMessage = document.getElementById('userLoggedMessage');
    if (userLoggedMessage) {
        userLoggedMessage.style.display = 'block';

        if (!document.getElementById('logoutBtnIndex')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtnIndex';
            logoutBtn.className = 'btn btn-ghost btn-full';
            logoutBtn.textContent = 'cerrar sesión';
            logoutBtn.style.marginTop = '1rem';
            logoutBtn.addEventListener('click', logout);
            userLoggedMessage.appendChild(logoutBtn);
        }
    }

    loadUserProgress();
}

function updateUIForLoggedOut() {
    const navZonaPersonal = document.getElementById('navZonaPersonal');
    const premiumContent = document.getElementById('premiumContent');
    const zonaPersonal = document.getElementById('zona-personal');

    if (navZonaPersonal) navZonaPersonal.style.display = 'none';
    if (premiumContent) premiumContent.style.display = 'none';
    if (zonaPersonal) zonaPersonal.style.display = 'none';

    const userLoggedMessage = document.getElementById('userLoggedMessage');
    if (userLoggedMessage) {
        userLoggedMessage.style.display = 'none';
        const logoutBtnIndex = document.getElementById('logoutBtnIndex');
        if (logoutBtnIndex) logoutBtnIndex.remove();
    }

    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    const loginForm = document.getElementById('loginForm');
    const loginTab = document.getElementById('loginTab');

    if (loginForm) loginForm.classList.add('active');
    if (loginTab) loginTab.classList.add('active');
}

// ===== CARGAR PROGRESO =====
async function loadUserProgress() {
    if (!currentUser) return;

    try {
        const userData = await apiRequest('/api/user/progress');

        const pauseCount = document.getElementById('pauseCount');
        const completedExercises = document.getElementById('completedExercises');
        const streakDays = document.getElementById('streakDays');
        const totalMinutes = document.getElementById('totalMinutes');

        if (pauseCount) pauseCount.textContent = userData.pauses || 0;
        if (completedExercises) completedExercises.textContent = userData.exercises || 0;
        if (streakDays) streakDays.textContent = userData.streak || 0;
        if (totalMinutes) totalMinutes.textContent = userData.minutes || 0;

        const statPauses = document.getElementById('statPauses');
        const statExercises = document.getElementById('statExercises');
        const statStreak = document.getElementById('statStreak');
        const statMinutes = document.getElementById('statMinutes');

        if (statPauses) statPauses.textContent = userData.pauses || 0;
        if (statExercises) statExercises.textContent = userData.exercises || 0;
        if (statStreak) statStreak.textContent = userData.streak || 0;
        if (statMinutes) statMinutes.textContent = userData.minutes || 0;

        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            const progressPercent = Math.min(100, ((userData.pauses || 0) / 10) * 100);
            progressFill.style.width = `${progressPercent}%`;
        }

        const currentStreak = document.getElementById('currentStreak');
        const totalExercises = document.getElementById('totalExercises');
        const achievementCount = document.getElementById('achievementCount');

        if (currentStreak) currentStreak.textContent = userData.streak || 0;
        if (totalExercises) totalExercises.textContent = userData.exercises || 0;

        const earnedAchievements = document.querySelectorAll('.achievement.earned').length;
        if (achievementCount) achievementCount.textContent = earnedAchievements;

    } catch (error) {
        console.error('Error cargando progreso:', error);
    }
}

// ===== LOGOUT =====
async function logout() {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        try {
            await apiRequest('/api/logout', 'POST');
            currentUser = null;

            if (isDashboard) {
                window.location.href = 'index.html';
            } else {
                updateUIForLoggedOut();
                closeUserPanel();

                const feedbackDiv = document.getElementById('exerciseFeedback');
                if (feedbackDiv) {
                    feedbackDiv.innerHTML = '👋 ¡Hasta pronto! Esperamos verte de nuevo.';
                    setTimeout(() => {
                        feedbackDiv.innerHTML = '';
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }
}

// ===== CÓDIGO ESPECÍFICO PARA INDEX.HTML =====
if (!isDashboard) {
    const userPanel = document.getElementById('userPanel');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const closePanel = document.getElementById('closePanel');
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);

    function openUserPanel() {
        userPanel.classList.add('open');
        overlay.classList.add('active');
    }

    function closeUserPanel() {
        userPanel.classList.remove('open');
        overlay.classList.remove('active');
    }

    if (userMenuBtn) userMenuBtn.addEventListener('click', openUserPanel);
    if (closePanel) closePanel.addEventListener('click', closeUserPanel);
    if (overlay) overlay.addEventListener('click', closeUserPanel);

    // TABS: Login / Registro / Recuperar (NUEVO)
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const recoverTab = document.getElementById('recoverTab');

    if (loginTab) {
        loginTab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            loginTab.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById('loginForm').classList.add('active');
            document.getElementById('recoverMessage').style.display = 'none';
        });
    }

    if (registerTab) {
        registerTab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            registerTab.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById('registerForm').classList.add('active');
            document.getElementById('recoverMessage').style.display = 'none';
        });
    }

    // NUEVO: Tab de recuperación
    if (recoverTab) {
        recoverTab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            recoverTab.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById('recoverForm').classList.add('active');
            document.getElementById('recoverMessage').style.display = 'none';
        });
    }

    // NUEVO: Enlaces de navegación
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('recoverTab').click();
    });

    document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginTab').click();
    });

    document.getElementById('backToLoginFromMessage')?.addEventListener('click', () => {
        document.getElementById('loginTab').click();
    });

    // ===== REGISTRO =====
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const phone = document.getElementById('regPhone').value;
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirm').value;

            if (password !== confirm) {
                alert('Las contraseñas no coinciden');
                return;
            }

            try {
                const result = await apiRequest('/api/register', 'POST', {
                    name, email, phone, password
                });

                currentUser = result.user;
                window.location.href = 'dashboard.html';

            } catch (error) {
                alert(error.message);
            }
        });
    }

    // ===== LOGIN =====
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const result = await apiRequest('/api/login', 'POST', { email, password });

                currentUser = result.user;
                window.location.href = 'dashboard.html';

            } catch (error) {
                alert(error.message);
            }
        });
    }

    // ===== NUEVO: RECUPERACIÓN DE CONTRASEÑA =====
    const recoverForm = document.getElementById('recoverForm');
    const recoverBtn = document.getElementById('recoverBtn');

    if (recoverForm) {
        recoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('recoverEmail').value;

            if (!email) {
                alert('Por favor ingresa tu email');
                return;
            }

            if (recoverBtn) {
                recoverBtn.disabled = true;
                recoverBtn.textContent = 'enviando...';
            }

            try {
                await apiRequest('/api/recover-password', 'POST', { email });

                document.getElementById('recoverForm').classList.remove('active');
                document.getElementById('recoverMessage').style.display = 'block';

            } catch (error) {
                alert(error.message || 'Error al procesar la solicitud');
            } finally {
                if (recoverBtn) {
                    recoverBtn.disabled = false;
                    recoverBtn.textContent = 'enviar instrucciones';
                }
            }
        });
    }

    // ===== EJERCICIO DEL DÍA =====
    const optionButtons = document.querySelectorAll('.option-btn');
    const feedbackDiv = document.getElementById('exerciseFeedback');
    const trackPauseBtn = document.getElementById('trackPauseBtn');

    optionButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            optionButtons.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            const answer = this.getAttribute('data-answer');

            if (answer === 'si') {
                feedbackDiv.innerHTML = '✨ ¡Excelente! Esas pequeñas pausas activan tu sistema nervioso y mejoran tu claridad mental. Sigue así.';
            } else {
                feedbackDiv.innerHTML = '🌊 Toma 30 segundos ahora: inhala profundo, exhala lento. Tu cerebro te lo agradecerá.';
            }
        });
    });

    // ===== REGISTRAR PAUSA =====
    if (trackPauseBtn) {
        trackPauseBtn.addEventListener('click', async () => {
            if (!currentUser) {
                alert('Debes iniciar sesión para registrar tu progreso');
                openUserPanel();
                return;
            }

            try {
                await apiRequest('/api/user/progress', 'POST', {
                    pauses: 1,
                    exercises: 0,
                    minutes: 2
                });

                await loadUserProgress();
                alert('¡Pausa registrada! Sigue así 💙');

            } catch (error) {
                alert('Error al registrar pausa');
            }
        });
    }
}

// ===== CÓDIGO ESPECÍFICO PARA DASHBOARD.HTML (TODO TU CÓDIGO ORIGINAL) =====
if (isDashboard) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (!logoutBtn.querySelector('.logout-icon')) {
            const icon = document.createElement('span');
            icon.className = 'logout-icon';
            icon.textContent = '🚪';
            logoutBtn.appendChild(icon);
        }
        logoutBtn.addEventListener('click', logout);
    }

    const saveExercisesBtn = document.getElementById('saveExercisesBtn');
    if (saveExercisesBtn) {
        saveExercisesBtn.addEventListener('click', async () => {
            if (!currentUser) return;

            const checkboxes = document.querySelectorAll('.exercise-item input[type="checkbox"]:checked');

            if (checkboxes.length === 0) {
                alert('Selecciona al menos un ejercicio');
                return;
            }

            try {
                await apiRequest('/api/user/progress', 'POST', {
                    pauses: 0,
                    exercises: checkboxes.length,
                    minutes: checkboxes.length * 10
                });

                checkboxes.forEach(cb => {
                    cb.checked = false;
                    cb.disabled = true;
                    setTimeout(() => { cb.disabled = false; }, 2000);
                });

                await loadUserProgress();
                alert(`✅ ¡${checkboxes.length} ejercicio(s) completado(s)! Has ganado ${checkboxes.length * 10} minutos de práctica.`);

            } catch (error) {
                alert('Error al guardar progreso');
            }
        });
    }

    // 1. Botón de refrescar gráfico
    document.getElementById('refreshChart')?.addEventListener('click', function() {
        generateWeeklyChart();
        this.style.transform = 'rotate(360deg)';
        setTimeout(() => { this.style.transform = 'rotate(0deg)'; }, 300);
    });

    // 2. Reproductor de recursos
    document.querySelectorAll('.resource-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const player = document.getElementById('miniPlayer');
            const nowPlaying = document.getElementById('nowPlaying');

            if (player && nowPlaying) {
                player.style.display = 'block';
                nowPlaying.textContent = this.textContent;

                setTimeout(() => {
                    player.style.backgroundColor = 'rgba(11, 42, 74, 0.05)';
                }, 500);
            }
        });
    });

    // 3. Controles del reproductor
    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.textContent === '⏸️') {
                this.textContent = '▶️';
            } else if (this.textContent === '▶️') {
                this.textContent = '⏸️';
            } else if (this.textContent === '⏹️') {
                const player = document.getElementById('miniPlayer');
                if (player) player.style.display = 'none';
            }
        });
    });

    // 4. Chat en vivo
    const chatInput = document.querySelector('.chat-input input');
    const chatSendBtn = document.querySelector('.chat-input .btn-icon');
    const chatMessages = document.querySelector('.chat-messages');

    if (chatSendBtn && chatInput && chatMessages) {
        chatSendBtn.textContent = '📤';

        chatSendBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendChatMessage();
        });

        function sendChatMessage() {
            if (chatInput.value.trim()) {
                const newMessage = document.createElement('div');
                newMessage.className = 'message';
                newMessage.innerHTML = `<strong>Tú (${currentUser?.name || 'Usuario'}):</strong> ${chatInput.value}`;
                chatMessages.appendChild(newMessage);
                chatInput.value = '';
                chatMessages.scrollTop = chatMessages.scrollHeight;

                setTimeout(() => {
                    const replies = [
                        '¡Qué interesante! Cuéntanos más.',
                        'Gracias por compartir 🙌',
                        'Eso es muy útil, gracias.',
                        '¿Alguien más opina lo mismo?'
                    ];
                    const randomReply = replies[Math.floor(Math.random() * replies.length)];
                    const reply = document.createElement('div');
                    reply.className = 'message';
                    reply.innerHTML = `<strong>Comunidad:</strong> ${randomReply}`;
                    chatMessages.appendChild(reply);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 1000);
            }
        }
    }

    // 5. Selector de estado de ánimo
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            const mood = this.dataset.mood;
            const recommendation = document.getElementById('moodRecommendation');

            const recommendations = {
                happy: '😊 ¡Qué bien! Aprovecha para hacer ejercicios de gratitud y compartir en la comunidad.',
                calm: '😌 Estado ideal para meditación profunda o escaneo corporal.',
                tired: '😴 Prueba con respiración energizante o una siesta consciente de 10 min.',
                stressed: '😰 Respiración 4-7-8 ahora mismo. Te ayudará a regular el sistema nervioso.',
                sad: '😔 Te recomendamos visualización positiva o contactar con la comunidad.'
            };

            recommendation.innerHTML = `<p>${recommendations[mood] || 'Selecciona un estado de ánimo'}</p>`;
        });
    });

    // 6. Notas automáticas
    const notesTextarea = document.querySelector('.notes-textarea');
    if (notesTextarea) {
        if (currentUser) {
            const savedNotes = localStorage.getItem(`mian_notes_${currentUser.email}`);
            if (savedNotes) notesTextarea.value = savedNotes;

            let timeout;
            notesTextarea.addEventListener('input', function() {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    localStorage.setItem(`mian_notes_${currentUser.email}`, this.value);
                    this.style.borderColor = 'var(--azul-profundo)';
                    setTimeout(() => { this.style.borderColor = ''; }, 500);
                }, 1000);
            });
        }
    }

    // 7. Sistema de notificaciones
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationCount = document.getElementById('notificationCount');

    if (notificationBadge && notificationCount) {
        let notifCount = 3;

        notificationBadge.addEventListener('click', function() {
            const notifications = [
                '🔔 Nuevo comentario en tu progreso',
                '🔔 Reto "7 días de meditación" completado',
                '🔔 Nuevo recurso disponible: "Mindfulness avanzado"',
                '🔔 La comunidad te ha dado 5 likes',
                '🔔 Tienes un nuevo logro por descubrir'
            ];

            let message = '📬 NOTIFICACIONES:\n\n';
            for (let i = 0; i < notifCount; i++) {
                message += `${notifications[i % notifications.length]}\n`;
            }

            alert(message);
            notifCount = 0;
            notificationCount.textContent = '0';
        });
    }

    // 8. Botón "ver todos los retos"
    document.querySelectorAll('.btn-ghost.btn-full').forEach(btn => {
        if (btn.textContent.includes('ver todos los retos')) {
            btn.addEventListener('click', function() {
                alert('🏆 PRÓXIMOS RETOS:\n\n• 30 días de meditación (en progreso)\n• 50 pausas conscientes (12/50)\n• Reto de gratitud (comienza en 3 días)\n• Desafío de atención plena (próximamente)');
            });
        }
    });

    // 9. Navegación del calendario
    document.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.addEventListener('click', function() {
            const monthSpan = this.parentElement.querySelector('span');
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            let currentMonth = monthSpan.textContent.split(' ')[0];
            let currentYear = parseInt(monthSpan.textContent.split(' ')[1]);

            if (this.textContent === '←') {
                let monthIndex = months.indexOf(currentMonth) - 1;
                if (monthIndex < 0) {
                    monthIndex = 11;
                    currentYear--;
                }
                monthSpan.textContent = `${months[monthIndex]} ${currentYear}`;
            } else {
                let monthIndex = months.indexOf(currentMonth) + 1;
                if (monthIndex > 11) {
                    monthIndex = 0;
                    currentYear++;
                }
                monthSpan.textContent = `${months[monthIndex]} ${currentYear}`;
            }

            monthSpan.style.transform = 'scale(1.1)';
            setTimeout(() => { monthSpan.style.transform = 'scale(1)'; }, 200);
        });
    });

    // 10. Botón "guardar entrada" del diario
    const diarySaveBtn = document.querySelector('.quick-notes + .btn-ghost, .diary-entry + .btn-ghost');
    if (diarySaveBtn) {
        diarySaveBtn.addEventListener('click', function() {
            const diaryText = document.querySelector('.diary-text');
            if (diaryText && diaryText.value.trim()) {
                alert('📝 Entrada guardada en tu diario personal');
                diaryText.style.backgroundColor = 'rgba(11, 42, 74, 0.05)';
                setTimeout(() => { diaryText.style.backgroundColor = ''; }, 500);
            } else {
                alert('Escribe algo antes de guardar');
            }
        });
    }

    // 11. Botones de recursos (PDF, etc.)
    document.querySelectorAll('.resources-list a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const type = this.dataset.type;
            const resourceName = this.textContent;

            const messages = {
                audio: '🎧 Reproduciendo: ',
                pdf: '📄 Descargando: ',
                video: '🎬 Cargando video: '
            };

            alert(messages[type] + resourceName);

            if (type === 'audio') {
                const player = document.getElementById('miniPlayer');
                const nowPlaying = document.getElementById('nowPlaying');
                if (player && nowPlaying) {
                    player.style.display = 'block';
                    nowPlaying.textContent = resourceName;
                }
            }
        });
    });

    // 12. Generar gráfico de actividad semanal
    function generateWeeklyChart() {
        const chartContainer = document.getElementById('weeklyChart');
        if (!chartContainer) return;

        const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        let activityData;

        if (currentUser) {
            const streak = currentUser.streak || 5;
            activityData = [
                Math.min(100, 50 + streak * 5),
                Math.min(100, 40 + streak * 4),
                Math.min(100, 70 + streak * 3),
                Math.min(100, 30 + streak * 6),
                Math.min(100, 60 + streak * 4),
                Math.min(100, 80 + streak * 2),
                Math.min(100, 50 + streak * 5)
            ];
        } else {
            activityData = [65, 45, 80, 30, 55, 70, 40];
        }

        let chartHTML = '';
        days.forEach((day, index) => {
            chartHTML += `
                <div class="bar-container">
                    <div class="bar" style="height: ${activityData[index]}%"></div>
                    <span class="bar-label">${day}</span>
                </div>
            `;
        });

        chartContainer.innerHTML = chartHTML;
    }

    // 13. Generar ejercicios personalizados
    const exercises = [
        { name: 'Respiración 4-7-8', level: 'beginner', time: '5 min', description: 'Técnica de relajación profunda' },
        { name: 'Escaneo corporal', level: 'beginner', time: '10 min', description: 'Conciencia corporal gradual' },
        { name: 'Meditación guiada', level: 'intermediate', time: '15 min', description: 'Con audio de Mian' },
        { name: 'Visualización positiva', level: 'intermediate', time: '8 min', description: 'Imagina tu mejor versión' },
        { name: 'Mindfulness avanzado', level: 'intermediate', time: '20 min', description: 'Atención plena profunda' },
        { name: 'Body scan profundo', level: 'intermediate', time: '25 min', description: 'Exploración corporal completa' }
    ];

    function renderExercises(filter = 'all') {
        const exerciseList = document.getElementById('exerciseList');
        if (!exerciseList) return;

        const filtered = filter === 'all' ? exercises : exercises.filter(e => e.level === filter);

        let html = '';
        filtered.forEach((ex, index) => {
            html += `
                <div class="exercise-item" title="${ex.description}">
                    <input type="checkbox" id="ex_${index}">
                    <label for="ex_${index}">
                        ${ex.name}
                        <span class="exercise-time">${ex.time}</span>
                        <span class="exercise-desc">${ex.description}</span>
                    </label>
                </div>
            `;
        });

        exerciseList.innerHTML = html;
    }

    // Inicializar
    generateWeeklyChart();
    renderExercises();

    // Filtros de ejercicios
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderExercises(this.dataset.filter);
        });
    });

    // Generador de rutina
    document.getElementById('generateRoutineBtn')?.addEventListener('click', function() {
        const routines = [
            '🌅 RUTINA MAÑANA:\n• Respiración 4-7-8 (5 min)\n• Escaneo corporal (10 min)\n• Visualización positiva (5 min)',
            '🌙 RUTINA NOCHE:\n• Meditación guiada (15 min)\n• Body scan (10 min)\n• Diario de gratitud (5 min)',
            '⚡ RUTINA EXPRESS:\n• Respiración consciente (3 min)\n• Mindfulness (5 min)\n• Estiramientos (5 min)',
            '🧘 RUTINA PROFUNDA:\n• Meditación avanzada (20 min)\n• Escaneo corporal (15 min)\n• Reflexión (10 min)'
        ];

        const randomRoutine = routines[Math.floor(Math.random() * routines.length)];
        alert('✨ ' + randomRoutine);
    });

    // Frase motivacional diaria
    const phrases = [
        '"El cuidado de tu mente es el mejor regalo que puedes hacerte hoy"',
        '"Pequeñas pausas, grandes cambios"',
        '"Hoy es un buen día para respirar y soltar"',
        '"Tu bienestar es tu prioridad"',
        '"Cada ejercicio cuenta, por pequeño que sea"',
        '"La constancia es más importante que la intensidad"',
        '"Respira, suelta, continúa"'
    ];

    const phraseElement = document.getElementById('motivationalPhrase');
    if (phraseElement) {
        const today = new Date().getDay();
        phraseElement.textContent = phrases[today % phrases.length];

        setInterval(() => {
            const randomIndex = Math.floor(Math.random() * phrases.length);
            phraseElement.style.opacity = '0';
            setTimeout(() => {
                phraseElement.textContent = phrases[randomIndex];
                phraseElement.style.opacity = '1';
            }, 500);
        }, 10000);
    }

    // Actualizar estadísticas comparativas
    async function updateComparisonStats() {
        if (!currentUser) return;

        try {
            const userData = await apiRequest('/api/user/progress');

            const improvement = Math.floor((userData.streak || 0) * 3) + 10;
            const positiveElement = document.querySelector('.comp-value.positive');
            if (positiveElement) positiveElement.textContent = `+${improvement}%`;

            const constancy = Math.min(100, Math.floor(((userData.exercises || 0) / 30) * 100));
            const constancyElement = document.querySelector('.comparison-item:nth-child(2) .comp-value');
            if (constancyElement) constancyElement.textContent = `${constancy}%`;

            const weeklyGoal = Math.min(10, Math.floor((userData.exercises || 0) / 3));
            const goalElement = document.querySelector('.comparison-item:nth-child(3) .comp-value');
            if (goalElement) goalElement.textContent = `${weeklyGoal}/10`;

            const achievements = document.querySelectorAll('.achievement.earned').length;
            const achievementProgress = document.getElementById('achievementProgress');
            if (achievementProgress) achievementProgress.textContent = `${achievements}/20`;

        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }

    updateComparisonStats();

    // Desbloquear logros basado en progreso
    async function checkAchievements() {
        if (!currentUser) return;

        try {
            const userData = await apiRequest('/api/user/progress');

            const achievements = [
                { name: 'Primera pausa', condition: (userData.pauses || 0) >= 1, element: 0 },
                { name: '7 días seguidos', condition: (userData.streak || 0) >= 7, element: 1 },
                { name: '10 meditaciones', condition: (userData.exercises || 0) >= 10, element: 2 },
                { name: '30 días', condition: (userData.streak || 0) >= 30, element: 3 },
                { name: '50 ejercicios', condition: (userData.exercises || 0) >= 50, element: 4 }
            ];

            achievements.forEach((ach) => {
                if (ach.condition) {
                    const achievementElements = document.querySelectorAll('.achievement');
                    if (achievementElements[ach.element]) {
                        achievementElements[ach.element].classList.add('earned');
                        achievementElements[ach.element].classList.remove('locked');
                        achievementElements[ach.element].querySelector('.achievement-icon').textContent = '🏆';
                    }
                }
            });

        } catch (error) {
            console.error('Error verificando logros:', error);
        }
    }

    checkAchievements();
}

// ===== INICIALIZACIÓN GLOBAL =====
window.addEventListener('load', () => {
    loadUserFromStorage();

    if (!isDashboard) {
        const heroElements = document.querySelectorAll('.hero .section-tag, .hero h1, .hero-description, .hero-buttons');
        heroElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            setTimeout(() => {
                el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 300 + (index * 200));
        });
    }
});