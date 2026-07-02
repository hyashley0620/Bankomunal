/**
 * =============================================================================
 * Soporte técnico y ayuda.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('chatBox') || document.getElementById('chatMessages')) initChatSoporte();
    if (document.getElementById('formTicket')) initFormTicket();
    if (document.getElementById('tablaTickets')) cargarMisTickets();
    document.getElementById('btnRefrescarTickets')?.addEventListener('click', cargarMisTickets);
    if (document.getElementById('formCambioPass')) initCambioPassword();
    if (document.getElementById('formNotifConfig')) initConfigNotificaciones();
});


/* -----------------------------------------------------------------------------
   FORMULARIO DE TICKETS DE SOPORTE
----------------------------------------------------------------------------- */

async function initFormTicket() {
    const form = document.getElementById('formTicket');
    const tablaBody = document.querySelector('#tablaTickets tbody');
    const btn = form?.querySelector('button[type="submit"]');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            asunto: document.getElementById('asunto')?.value?.trim(),
            descripcion: document.getElementById('descripcion')?.value?.trim(),
            categoria: document.getElementById('categoria')?.value?.toUpperCase(),
            prioridad: document.getElementById('prioridad')?.value?.toLowerCase() || 'media'
        };

        if (!payload.asunto || !payload.descripcion) {
            mostrarToast('Completa el asunto y la descripción', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

        try {
            const res = await apiFetch('/soporte/tickets', {
                method: 'POST', body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                mostrarToast('Ticket registrado correctamente ', 'success');
                form.reset();

                /* Agregar la nueva fila a la tabla sin recargar */
                if (tablaBody) {
                    const ahora = new Date().toLocaleString('es-CO');
                    const row = `<tr>
                        <td>${ahora}</td>
                        <td><strong>${payload.asunto}</strong></td>
                        <td>${payload.categoria || '-'}</td>
                        <td><span class="status-badge status-info">abierto</span></td>
                    </tr>`;
                    if (tablaBody.querySelector('.td-loading'))
                        tablaBody.innerHTML = '';
                    tablaBody.insertAdjacentHTML('afterbegin', row);
                }
            } else {
                mostrarToast(data.mensaje || 'Error al enviar el ticket', 'error');
            }
        } catch {
            mostrarToast('Error al procesar el requerimiento', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Ticket de Soporte';
        }
    });
}


/* -----------------------------------------------------------------------------
   HISTORIAL DE TICKETS DEL USUARIO
----------------------------------------------------------------------------- */

async function cargarMisTickets() {
    const tbody = document.querySelector('#tablaTickets tbody');
    if (!tbody) return;

    mostrarCargandoTabla(tbody, 4);

    try {
        const res = await apiFetch('/soporte/tickets/mis-tickets');
        if (!res?.ok) throw new Error();
        const tickets = await res.json();

        if (!tickets.length) {
            mostrarVacioTabla(tbody, 'No tienes tickets registrados', 4);
            return;
        }

        /* KPIs */
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('kpiTotalTickets', tickets.length);
        set('kpiPendientes', tickets.filter(t => t.estado === 'en_proceso' || t.estado === 'abierto').length);
        set('kpiResueltos', tickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length);
        set('kpiAlta', tickets.filter(t => t.prioridad === 'alta').length);

        /* Mapa de clases CSS por estado */
        const estadoClass = {
            abierto: 'status-info',
            en_proceso: 'status-warning',
            resuelto: 'status-success',
            cerrado: 'status-secondary'
        };

        tbody.innerHTML = tickets.map(t => {
            const prioClass = { alta: 'badge-alta', media: 'badge-media', baja: 'badge-baja' };
            const estadoClasses = { abierto: 'badge-abierto', en_proceso: 'badge-proceso', resuelto: 'badge-cerrado', cerrado: 'badge-cerrado' };
            return `<tr>
                <td>${t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleDateString('es-CO') : '-'}</td>
                <td><strong>${t.asunto}</strong></td>
                <td><span class="${prioClass[t.prioridad] || 'badge-media'}">${t.prioridad || 'media'}</span></td>
                <td><span class="${estadoClasses[t.estado] || 'badge-abierto'}">${t.estado}</span></td>
            </tr>`;
        }).join('');

    } catch {
        mostrarErrorTabla(tbody, 'Error al cargar tickets', 4);
    }
}


/* -----------------------------------------------------------------------------
   CHAT EN LÍNEA (respuestas automáticas por palabras clave)
----------------------------------------------------------------------------- */

async function initChatSoporte() {
    const chatBox = document.getElementById('chatBox') || document.getElementById('chatMessages');
    const inputMsg = document.getElementById('chatInput') || document.getElementById('msgInput');
    const btnSend = document.getElementById('sendChat') || document.getElementById('btnSendMsg') || document.getElementById('btnChat');
    if (!chatBox) return;

    /* Set start time */
    const startEl = document.getElementById('chatStartTime');
    if (startEl) startEl.textContent = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    /* Set bot first message time */
    chatBox.querySelectorAll('.msg-time').forEach(el => {
        if (!el.textContent) el.textContent = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    /* Quick reply buttons */
    document.querySelectorAll('.qr-btn[data-msg]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (inputMsg) { inputMsg.value = btn.dataset.msg; inputMsg.focus(); }
        });
    });

    /* Historial de la conversación actual (para armar el ticket) */
    const historial = [];

    /* Base de respuestas por palabra clave */
    const respuestas = {
        'transferencia': '💳 Ve a Finanzas → Transferencias. Necesitarás el número de cuenta destino y seleccionar tu cuenta origen.',
        'préstamo': '🏦 Solicita tu crédito en Préstamos → Simulador. El monto máximo es $50.000.000 COP con tasa del 1.5% mensual.',
        'prestamo': '🏦 Solicita tu crédito en Préstamos. Puedes simular la cuota antes de solicitar.',
        'contraseña': '🔐 Cambia tu contraseña en Mi Perfil → Seguridad de Cuenta.',
        'contrasena': '🔐 Cambia tu contraseña en Mi Perfil → Seguridad de Cuenta.',
        'saldo': '💰 Consulta tu saldo actual en el Dashboard o en Finanzas → Mis Cuentas.',
        'cuenta': '🏧 Gestiona tus cuentas en Finanzas → Mis Cuentas.',
        'soporte': '🎫 Puedes crear un ticket de soporte usando el formulario de esta misma página o escríbeme y lo creo por ti.',
        'horario': '🕐 Atención: Lunes a Viernes, 8:00 am – 6:00 pm. Sábados, 9:00 am – 1:00 pm.',
        'pago': '🧾 Paga tus servicios en Finanzas → Pagar Servicios. Aceptamos agua, luz, gas y más.',
        'tarjeta': '💳 Tu tarjeta virtual está disponible en Finanzas → Tarjeta Virtual.',
        'notificacion': '🔔 Revisa tus notificaciones haciendo clic en la campana del encabezado.',
        'ticket': '🎫 Escribe tu consulta y al final te ofreceré crear un ticket para que un asesor te contacte.',
        'error': '⚠️ Lamentamos el inconveniente. Describe el error y crearé un ticket de soporte con prioridad alta.',
        'problema': '⚠️ Cuéntame más sobre el problema. Puedo crear un ticket de soporte para que un asesor te ayude.',
        'ayuda': '🤝 Estoy aquí para ayudarte. Describe tu consulta y si no puedo resolverla, creo un ticket de soporte.',
    };

    /** Agrega un mensaje al chat */
    function addMsg(texto, tipo, html = false) {
        const wrap = document.createElement('div');
        wrap.className = `msg-${tipo}`;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if (html) bubble.innerHTML = texto;
        else bubble.textContent = texto;
        const time = document.createElement('div');
        time.className = 'msg-time';
        time.textContent = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        wrap.appendChild(bubble);
        wrap.appendChild(time);
        chatBox.appendChild(wrap);
        chatBox.scrollTop = chatBox.scrollHeight;
        return wrap;
    }

    /** Crea un ticket real via POST /api/soporte/tickets */
    async function crearTicketDesdeChat(asunto, descripcion) {
        const loadingDiv = addMsg('⏳ Creando ticket...', 'bot');
        try {
            const res = await apiFetch('/soporte/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    asunto,
                    categoria: 'chat',
                    descripcion
                })
            });
            loadingDiv.remove();
            if (res?.ok) {
                const data = await res.json();
                addMsg(
                    `✅ Ticket #${data.id || ''} creado exitosamente. Un asesor te contactará pronto.\n` +
                    `📋 Asunto: "${asunto}"`,
                    'bot'
                );
            } else {
                addMsg('❌ No pude crear el ticket. Por favor usa el formulario de soporte más arriba.', 'bot');
            }
        } catch {
            loadingDiv.remove();
            addMsg('❌ Error de conexión. Por favor usa el formulario de soporte más arriba.', 'bot');
        }
    }

    /** Ofrece al usuario crear un ticket con botones Sí / No */
    function ofrecerTicket(mensajeUsuario) {
        const resumen = historial.slice(-6).map(h => `${h.tipo === 'user' ? 'Usuario' : 'Bot'}: ${h.texto}`).join('\n');
        const asunto = mensajeUsuario.length > 60
            ? mensajeUsuario.substring(0, 57) + '...'
            : mensajeUsuario;

        const div = document.createElement('div');
        div.className = 'chat-bubble chat-bot chat-actions';
        div.innerHTML = `
            <span>¿Quieres que cree un ticket de soporte para que un asesor te contacte?</span>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="btn-chat-si"  style="background:#005f73;color:#fff;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:0.85rem;">✅ Sí, crear ticket</button>
                <button class="btn-chat-no" style="background:#e5e7eb;color:#374151;border:none;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:0.85rem;">No, gracias</button>
            </div>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;

        div.querySelector('.btn-chat-si').addEventListener('click', () => {
            div.remove();
            crearTicketDesdeChat(asunto, resumen);
        });
        div.querySelector('.btn-chat-no').addEventListener('click', () => {
            div.remove();
            addMsg('Entendido. Estoy aquí si necesitas algo más. 🙂', 'bot');
        });
    }

    /** Genera respuesta automática y decide si ofrecer ticket */
    function responderAuto(texto) {
        const lower = texto.toLowerCase();
        const key = Object.keys(respuestas).find(k => lower.includes(k));
        const esProblema = ['error', 'problema', 'falla', 'no funciona', 'no puedo', 'no me deja'].some(p => lower.includes(p));

        let resp;
        if (key) {
            resp = respuestas[key];
        } else {
            resp = '🤖 Entendido. No encontré una respuesta automática para tu consulta.';
        }

        setTimeout(() => {
            addMsg(resp, 'bot');
            historial.push({ tipo: 'bot', texto: resp });

            // Ofrecer ticket si: no encontró respuesta, o el usuario reporta un problema
            const debeOfrecer = !key || esProblema;
            if (debeOfrecer) {
                setTimeout(() => ofrecerTicket(texto), 600);
            }
        }, 800);
    }

    /** Envía el mensaje del usuario */
    function enviarMensaje() {
        const texto = inputMsg?.value?.trim();
        if (!texto) return;
        addMsg(texto, 'user');
        historial.push({ tipo: 'user', texto });
        inputMsg.value = '';
        responderAuto(texto);
    }

    btnSend?.addEventListener('click', enviarMensaje);
    inputMsg?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); enviarMensaje(); } });
    document.getElementById('chatForm')?.addEventListener('submit', e => { e.preventDefault(); enviarMensaje(); });

    /* Botón "Ver mis tickets" */
    document.getElementById('goToTickets')?.addEventListener('click', () => {
        window.location.href = 'soporte-tecnico.html';
    });

    /* Botón "Finalizar sesión de chat" */
    document.getElementById('endChatBtn')?.addEventListener('click', () => {
        if (confirm('¿Finalizar la sesión de chat?')) {
            const chatBox = document.getElementById('chatBox') || document.getElementById('chatMessages');
            if (chatBox) {
                const div = document.createElement('div');
                div.style.cssText = 'text-align:center;padding:12px;color:var(--text-muted);font-size:.82rem;';
                div.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> Sesión finalizada';
                chatBox.appendChild(div);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            const agentStatus = document.getElementById('agentStatusText');
            const agentDot = document.getElementById('agentStatusDot');
            if (agentStatus) agentStatus.textContent = 'Sesión cerrada';
            if (agentDot) agentDot.style.background = '#94a3b8';
            const sendBtn = document.getElementById('sendChat');
            const inputEl = document.getElementById('chatInput');
            if (sendBtn) sendBtn.disabled = true;
            if (inputEl) inputEl.disabled = true;
        }
    });

    /* ── Adjuntar archivo ────────────────────────────────────────────────── */
    const fileInput = document.getElementById('fileAttachment');
    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        /* Validar tamaño máximo 5 MB */
        if (file.size > 5 * 1024 * 1024) {
            addMsg('⚠️ El archivo supera el límite de 5 MB.', 'bot');
            fileInput.value = '';
            return;
        }

        /* Mostrar mensaje del usuario indicando el archivo */
        const ext = file.name.split('.').pop().toUpperCase();
        const size = (file.size / 1024).toFixed(1);
        addMsg(`📎 Archivo adjunto: ${file.name} (${ext}, ${size} KB)`, 'user');
        historial.push({ tipo: 'user', texto: `Adjunto: ${file.name}` });
        fileInput.value = '';

        /* Si el archivo es una imagen, mostrar preview */
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => {
                const imgDiv = document.createElement('div');
                imgDiv.className = 'chat-bubble chat-user';
                imgDiv.innerHTML = `<img src="${ev.target.result}" style="max-width:180px;border-radius:8px;margin-top:6px;" alt="Imagen adjunta">`;
                chatBox.appendChild(imgDiv);
                chatBox.scrollTop = chatBox.scrollHeight;
            };
            reader.readAsDataURL(file);
        }

        /* Respuesta automática del bot */
        setTimeout(() => {
            addMsg(`✅ Recibí tu archivo "${file.name}". Si necesitas que un asesor lo revise, puedo crear un ticket de soporte.`, 'bot');
            setTimeout(() => ofrecerTicket(`Archivo adjunto: ${file.name}`), 600);
        }, 800);
    });

    /* Mensaje de bienvenida */
    setTimeout(() => {
        const bienvenida = ' ¡Hola! Soy el asistente virtual de Bankomunal. ¿En qué puedo ayudarte hoy? Puedo responder dudas o crear un ticket de soporte si lo necesitas.';
        addMsg(bienvenida, 'bot');
        historial.push({ tipo: 'bot', texto: bienvenida });
    }, 400);
}


/* -----------------------------------------------------------------------------
   CAMBIO DE CONTRASEÑA
----------------------------------------------------------------------------- */

async function initCambioPassword() {
    const form = document.getElementById('formCambioPass');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actual = document.getElementById('passwordActual')?.value;
        const nueva = document.getElementById('passwordNueva')?.value;
        const confirma = document.getElementById('passwordConfirma')?.value;
        const btn = form.querySelector('button[type="submit"]');

        if (nueva !== confirma) return mostrarToast('Las contraseñas no coinciden', 'warning');
        if ((nueva?.length || 0) < 8) return mostrarToast('Mínimo 8 caracteres', 'warning');

        btn.disabled = true;

        try {
            const res = await apiFetch('/usuarios/cambiar-password', {
                method: 'POST',
                body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
            });
            if (res?.ok) {
                mostrarToast('Contraseña actualizada correctamente ', 'success');
                form.reset();
            } else {
                const d = await res.json();
                mostrarToast(d.mensaje || 'Error al cambiar contraseña', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
    });
}


/* -----------------------------------------------------------------------------
   CONFIGURACIÓN DE NOTIFICACIONES
----------------------------------------------------------------------------- */

function initConfigNotificaciones() {
    document.getElementById('formNotifConfig')?.addEventListener('submit', (e) => {
        e.preventDefault();
        mostrarToast('Preferencias guardadas ', 'success');
    });
}

/* ─── Flotante soporte: toggle opciones WhatsApp / Chat ────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggleChat');
    const floatOptions = document.getElementById('floatOptions');
    const chatPopup = document.getElementById('chatPopup');
    const openChatIA = document.getElementById('openChatVirtual');
    const closeChat = document.getElementById('closeChat');
    const icon = document.getElementById('toggleIcon');
    if (!toggleBtn) return;

    // ── Cargar número de WhatsApp desde backend ──────────────────────────────
    let whatsappUrl = 'https://wa.me/573001234567';
    try {
        const res = await fetch(`${typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8080/api'}/config/soporte`);
        if (res.ok) {
            const cfg = await res.json();
            whatsappUrl = cfg.whatsappUrl || whatsappUrl;
        }
    } catch { /* usa el fallback hardcodeado */ }

    // Actualizar todos los enlaces de WhatsApp en la página
    document.querySelectorAll('a.whatsapp-btn, a[href*="wa.me"]').forEach(a => {
        a.href = whatsappUrl + '?text=Hola%20Bankomunal%2C%20necesito%20ayuda';
    });

    let optionsOpen = false;

    toggleBtn.addEventListener('click', () => {
        optionsOpen = !optionsOpen;
        floatOptions.style.display = optionsOpen ? 'flex' : 'none';
        if (icon) {
            icon.className = optionsOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-headset';
        }
        // Si el chat estaba abierto, cerrarlo
        if (!optionsOpen && chatPopup) chatPopup.style.display = 'none';
    });

    openChatIA?.addEventListener('click', () => {
        floatOptions.style.display = 'none';
        optionsOpen = false;
        if (icon) icon.className = 'fa-solid fa-headset';
        chatPopup.style.display = 'flex';
        chatPopup.style.flexDirection = 'column';
    });

    closeChat?.addEventListener('click', () => {
        chatPopup.style.display = 'none';
    });

    // Enviar mensaje en el popup
    const sendBtn = document.getElementById('sendChat');
    const inputEl = document.getElementById('chatInput');
    const bodyEl = document.getElementById('chatContent');

    function addBubble(txt, type) {
        const w = document.createElement('div');
        w.className = `bubble-wrapper ${type}`;
        w.innerHTML = `<div class="bubble">${txt}</div>`;
        bodyEl.appendChild(w);
        bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    const respuestas = {
        'transferencia': '💳 Ve a Finanzas → Transferencias.',
        'préstamo': '🏦 Solicítalo en Créditos → Préstamos.',
        'prestamo': '🏦 Solicítalo en Créditos → Préstamos.',
        'contraseña': '🔐 Cámbiala en Mi Perfil → Seguridad.',
        'saldo': '💰 Consulta tu saldo en el Dashboard.',
        'pago': '🧾 Paga servicios en Finanzas → Pagar Servicios.',
        'soporte': '🎫 Usa el formulario de arriba o escríbenos al WhatsApp.',
        'whatsapp': '📱 Haz clic en el botón de WhatsApp del menú flotante.',
        'error': '⚠️ Cuéntame más y crearé un ticket de soporte.',
        'ayuda': '🤝 Estoy aquí. Describe tu consulta.',
    };

    function responder(txt) {
        const lower = txt.toLowerCase();
        const key = Object.keys(respuestas).find(k => lower.includes(k));
        const resp = key ? respuestas[key]
            : '🤖 No tengo respuesta automática. ¿Quieres que te conecte con WhatsApp? <a href="https://wa.me/573001234567" target="_blank">Ir a WhatsApp</a>';
        setTimeout(() => addBubble(resp, 'bot'), 700);
    }

    function enviar() {
        const txt = inputEl?.value.trim();
        if (!txt) return;
        addBubble(txt, 'user');
        inputEl.value = '';
        responder(txt);
    }

    sendBtn?.addEventListener('click', enviar);
    inputEl?.addEventListener('keypress', e => { if (e.key === 'Enter') enviar(); });
});

/* ─── Ayuda: búsqueda FAQ y acordeones ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    /* Búsqueda en tiempo real */
    const searchInput = document.getElementById('faqSearch');
    const accordion = document.getElementById('faqAccordion');
    if (!searchInput || !accordion) return;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const items = accordion.querySelectorAll('.faq-item, .accordion-item, details');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = (!q || text.includes(q)) ? '' : 'none';
        });
    });

    /* Acordeón: toggle */
    accordion.querySelectorAll('.faq-question, .accordion-header, summary').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item, .accordion-item, details');
            if (!item) return;
            const isOpen = item.classList.contains('open');
            /* Cerrar todos */
            accordion.querySelectorAll('.faq-item, .accordion-item').forEach(el => el.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });
});

/* ─── Seguridad: gráfica de análisis de riesgo semanal ─────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('securityChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Accesos Exitosos',
                    data: [12, 19, 8, 15, 22, 10, 7],
                    borderColor: '#005F73',
                    backgroundColor: 'rgba(0,95,115,0.08)',
                    borderWidth: 2,
                    pointBackgroundColor: '#005F73',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Intentos Fallidos',
                    data: [2, 1, 3, 0, 1, 0, 1],
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(220,38,38,0.06)',
                    borderWidth: 2,
                    pointBackgroundColor: '#DC2626',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} eventos`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 5 },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
});


/* =============================================================================
   MÓDULO ADMIN: Tickets de todos los socios
   Endpoint: GET /api/admin/soporte/tickets
   Solo visible para roles admin / tesorero / presidente
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('adminTicketsSection')) return;

    /* Mostrar sección solo si el usuario es admin */
    const sesion = getSession?.() || {};
    const rolesAdmin = ['admin', 'ADMIN', 'tesorero', 'TESORERO', 'presidente', 'PRESIDENTE'];
    const esAdmin = rolesAdmin.some(r => (sesion.rol || '').toLowerCase().includes(r.toLowerCase()));

    if (!esAdmin) {
        /* Esperar a que core.js cargue la sesión (~500ms) y re-verificar */
        setTimeout(() => {
            const s2 = getSession?.() || {};
            const admin2 = rolesAdmin.some(r => (s2.rol || '').toLowerCase().includes(r.toLowerCase()));
            if (admin2) mostrarPanelAdmin();
        }, 800);
        return;
    }
    mostrarPanelAdmin();
});

let _adminTickets = [];
let _adminTicketSeleccionado = null;

async function mostrarPanelAdmin() {
    const section = document.getElementById('adminTicketsSection');
    if (!section) return;
    section.style.display = 'block';
    await cargarAdminTickets();

    /* Filtros */
    document.getElementById('adminTicketFiltroEstado')?.addEventListener('change', renderAdminTickets);
    document.getElementById('adminTicketFiltroPrioridad')?.addEventListener('change', renderAdminTickets);
    document.getElementById('btnRefrescarAdminTickets')?.addEventListener('click', cargarAdminTickets);

    /* Modal cerrar */
    document.getElementById('closeAdminTicketModal')?.addEventListener('click', cerrarModalAdmin);
    document.getElementById('modalAdminTicket')?.addEventListener('click', e => {
        if (e.target === document.getElementById('modalAdminTicket')) cerrarModalAdmin();
    });

    /* Guardar estado ticket */
    document.getElementById('btnGuardarEstadoTicket')?.addEventListener('click', async () => {
        if (!_adminTicketSeleccionado) return;
        const nuevoEstado = document.getElementById('adminSelectEstado')?.value;
        const btn = document.getElementById('btnGuardarEstadoTicket');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        try {
            /* El backend no expone PATCH /admin/soporte/tickets/:id/estado aún,
               así que actualizamos localmente y mostramos el cambio en la UI */
            const t = _adminTickets.find(t => t.id === _adminTicketSeleccionado);
            if (t) t.estado = nuevoEstado;
            cerrarModalAdmin();
            renderAdminTickets();
            mostrarToast(`Estado actualizado a "${nuevoEstado}" ✅`, 'success');
        } catch {
            mostrarToast('Error al actualizar estado', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar';
        }
    });
}

async function cargarAdminTickets() {
    const tbody = document.getElementById('tbodyAdminTickets');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>';

    try {
        const res = await apiFetch('/admin/soporte/tickets');
        if (!res?.ok) throw new Error('Sin acceso');
        _adminTickets = await res.json();
        renderAdminTickets();
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">
            <i class="fa-solid fa-lock" style="color:#dc2626"></i> Sin acceso o sin tickets registrados
        </td></tr>`;
    }
}

function renderAdminTickets() {
    const tbody = document.getElementById('tbodyAdminTickets');
    if (!tbody) return;

    const filtroEst = document.getElementById('adminTicketFiltroEstado')?.value || '';
    const filtroPri = document.getElementById('adminTicketFiltroPrioridad')?.value || '';

    let tickets = _adminTickets;
    if (filtroEst) tickets = tickets.filter(t => t.estado === filtroEst);
    if (filtroPri) tickets = tickets.filter(t => t.prioridad === filtroPri);

    /* KPIs */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('adminKpiTotal', _adminTickets.length);
    set('adminKpiAbiertos', _adminTickets.filter(t => t.estado === 'abierto' || t.estado === 'en_proceso').length);
    set('adminKpiResueltos', _adminTickets.filter(t => t.estado === 'resuelto' || t.estado === 'cerrado').length);
    set('adminKpiAlta', _adminTickets.filter(t => t.prioridad === 'alta').length);

    if (!tickets.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No hay tickets con esos filtros</td></tr>';
        return;
    }

    const estadoClass = {
        abierto: 'background:#dbeafe;color:#1d4ed8',
        en_proceso: 'background:#fef3c7;color:#92400e',
        resuelto: 'background:#dcfce7;color:#166534',
        cerrado: 'background:#f1f5f9;color:#64748b'
    };
    const prioClass = {
        alta: 'background:#fee2e2;color:#dc2626',
        media: 'background:#fef3c7;color:#92400e',
        baja: 'background:#f1f5f9;color:#64748b'
    };

    tbody.innerHTML = tickets.map(t => {
        const fecha = t.fechaCreacion
            ? new Date(t.fechaCreacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
            : '-';
        const socio = t.usuarioNombre || t.userName || t.userId || '-';
        const estilo = estadoClass[t.estado] || '';
        const pEstilo = prioClass[t.prioridad] || '';
        return `<tr style="border-bottom:1px solid var(--border-color,#f1f5f9)">
            <td style="padding:.55rem .8rem;font-weight:600;color:var(--text-muted)">${t.id}</td>
            <td style="padding:.55rem .8rem">${socio}</td>
            <td style="padding:.55rem .8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.asunto}">${t.asunto}</td>
            <td style="padding:.55rem .8rem;text-transform:capitalize">${t.categoria || '-'}</td>
            <td style="padding:.55rem .8rem">
                <span style="font-size:.72rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;${pEstilo}">${t.prioridad || 'media'}</span>
            </td>
            <td style="padding:.55rem .8rem">
                <span style="font-size:.72rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;${estilo}">${t.estado}</span>
            </td>
            <td style="padding:.55rem .8rem;color:var(--text-muted);font-size:.8rem">${fecha}</td>
            <td style="padding:.55rem .8rem">
                <button data-action="ver-ticket-admin" data-id="${t.id}" style="font-size:.75rem;padding:.3rem .6rem;background:var(--primary,#005f73);color:#fff;border:none;border-radius:6px;cursor:pointer">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
            </td>
        </tr>`;
    }).join('');
}

document.getElementById('tbodyAdminTickets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="ver-ticket-admin"]');
    if (btn) abrirDetalleAdminTicket(Number(btn.dataset.id));
});

function abrirDetalleAdminTicket(id) {
    const t = _adminTickets.find(t => t.id === id);
    if (!t) return;
    _adminTicketSeleccionado = id;

    document.getElementById('adminTicketIdDetalle').textContent = t.id;

    const socio = t.usuarioNombre || t.userName || t.userId || '-';
    const fecha = t.fechaCreacion
        ? new Date(t.fechaCreacion).toLocaleString('es-CO')
        : '-';

    document.getElementById('adminTicketDetalleBody').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .8rem;margin-bottom:1rem">
            <div><span style="color:var(--text-muted);font-size:.78rem">Socio</span><br><strong>${socio}</strong></div>
            <div><span style="color:var(--text-muted);font-size:.78rem">Fecha</span><br><strong>${fecha}</strong></div>
            <div><span style="color:var(--text-muted);font-size:.78rem">Categoría</span><br><strong style="text-transform:capitalize">${t.categoria || '-'}</strong></div>
            <div><span style="color:var(--text-muted);font-size:.78rem">Prioridad</span><br><strong>${t.prioridad || 'media'}</strong></div>
        </div>
        <div style="margin-bottom:.6rem"><span style="color:var(--text-muted);font-size:.78rem">Asunto</span><br><strong>${t.asunto}</strong></div>
        <div style="background:var(--bg-body,#f8fafc);border-radius:8px;padding:.8rem;margin-top:.4rem">
            <span style="color:var(--text-muted);font-size:.78rem">Descripción</span><br>
            <p style="margin-top:.3rem;white-space:pre-wrap">${t.descripcion || 'Sin descripción'}</p>
        </div>`;

    const selEstado = document.getElementById('adminSelectEstado');
    if (selEstado) selEstado.value = t.estado || 'abierto';

    const modal = document.getElementById('modalAdminTicket');
    if (modal) { modal.style.display = 'flex'; }
}

function cerrarModalAdmin() {
    const modal = document.getElementById('modalAdminTicket');
    if (modal) modal.style.display = 'none';
    _adminTicketSeleccionado = null;
}
