/**
 * =============================================================================
 * Funciones compartidas por TODAS las páginas internas.
 *
 * GUARD DE AUTENTICACIÓN: redirige automáticamente al login si no hay sesión.
 *
 * Incluye:
 *   - Guard de autenticación global (verifyAuth)
 *   - Render de interfaz de usuario (nombre, rol, avatar)
 *   - Modo oscuro con persistencia
 *   - Sidebar móvil con overlay
 *   - Notificaciones (badge + marcar leídas)
 *   - Búsqueda global en tablas
 *   - Exportación de archivos
 *   - Toast de notificaciones
 *   - Utilidades: formatearCOP, setupMoneyInput, mostrar/ocultar tabla
 * =============================================================================
 */


/* =============================================================================
   GUARD DE AUTENTICACIÓN GLOBAL
   Verifica que el usuario tenga token activo antes de mostrar la página.
   Si no hay token → redirige a login.html de forma inmediata.
   ============================================================================= */

/**
 * Verifica sesión activa. Si no existe, redirige al login antes de que
 * el usuario vea cualquier contenido de la página protegida.
 */
function verifyAuth() {
    const token = localStorage.getItem('authToken');
    const session = localStorage.getItem('userSession');

    if (!token || !session || session === '{}') {
        // Ocultar el body inmediatamente para evitar flash de contenido
        document.documentElement.style.visibility = 'hidden';
        window.location.replace('../login.html');
        return false;
    }
    // Si hay sesión, restaurar visibilidad (por si se ocultó antes)
    document.documentElement.style.visibility = 'visible';
    return true;
}


/* =============================================================================
   INICIALIZACIÓN GLOBAL
   Se ejecuta en DOMContentLoaded en todas las páginas internas.
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar autenticación PRIMERO — si falla, para todo
    if (!verifyAuth()) return;

    // 2. Inicializar módulos en orden
    initDarkMode();
    actualizarInterfazUsuario();
    initSidebarMobile();
    initLogout();
    initNotifications();
    initGlobalSearch();
    initExportButtons();
    initGenericUIActions();
    cargarBadgeNotificaciones();

    /* ── Botón Reporte WhatsApp (dashboard) ─────────────────────────────────── */
    document.querySelectorAll('[data-msg], .btn-whatsapp, #btnWhatsapp').forEach(btn => {
        if (!btn.textContent.includes('WhatsApp')) return;
        btn.addEventListener('click', async () => {
            const session = getSession();
            let resumen = `*Reporte Bankomunal* 📊\n`;
            resumen += `Usuario: ${session.nombre || 'Usuario'}\n`;
            resumen += `Cuenta: ${session.cuenta || '-'}\n`;
            resumen += `Saldo: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(session.saldoTotal || 0)}\n`;
            resumen += `Fecha: ${new Date().toLocaleString('es-CO')}\n`;
            resumen += `\n_Generado desde Bankomunal_ 🏦`;

            const url = 'https://wa.me/?text=' + encodeURIComponent(resumen);
            window.open(url, '_blank');
        });
    });

});


/* =============================================================================
   IDENTIDAD Y SESIÓN
   ============================================================================= */

/**
 * Renderiza nombre, rol e iniciales del avatar desde localStorage.
 * Lee la sesión guardada por app.js tras el login.
 */
function actualizarInterfazUsuario() {
    const session = getSession();
    if (!session || !session.nombre) return;

    // Nombre y rol en header / sidebar
    document.querySelectorAll('#nombreUsuario, .user-name-text')
        .forEach(el => { el.textContent = session.nombre; });
    document.querySelectorAll('#rolUsuario, .user-role-text')
        .forEach(el => { el.textContent = session.rol || 'Socio'; });

    // Avatar: foto guardada, o ícono por género, o iniciales
    const BACKEND_URL = 'http://localhost:8080';
    document.querySelectorAll('#avatarUsuario, .avatar-circle, .user-avatar-placeholder')
        .forEach(el => {
            if (el.tagName === 'IMG') return;

            if (session.fotoUrl) {
                const relFoto = (typeof normalizarFotoUrlRelativa === 'function')
                    ? normalizarFotoUrlRelativa(session.fotoUrl)
                    : (session.fotoUrl.startsWith('/') ? session.fotoUrl : '/' + session.fotoUrl);
                const urlAbs = relFoto.startsWith('http') || relFoto.startsWith('data:')
                    ? relFoto
                    : BACKEND_URL + relFoto;
                el.style.backgroundImage = `url(${urlAbs})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.textContent = '';
            } else if (session.genero === 'femenino') {
                el.innerHTML = '<i class="fa-solid fa-user-nurse"></i>';
                el.style.background = '#e9ecef';
                el.style.color = '#005F73';
            } else {
                el.textContent = session.iniciales ||
                    (session.nombre || 'U').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
            }
        });

    // Saldo global si existe el elemento
    const saldoEl = document.getElementById('saldoGlobal');
    if (saldoEl && session.saldoTotal !== undefined) {
        saldoEl.textContent = formatearCOP(session.saldoTotal);
    }
}

/**
 * Enlaza el botón de cerrar sesión (.logout / #logoutBtn).
 * Pide confirmación antes de limpiar el storage.
 */
function initLogout() {
    document.querySelectorAll('.logout, #logoutBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('¿Desea cerrar su sesión de forma segura?')) {
                cerrarSesion();
            }
        });
    });
}


/* =============================================================================
   MODO OSCURO
   ============================================================================= */

/**
 * Restaura la preferencia de modo oscuro y escucha el botón #themeBtn.
 */
function initDarkMode() {
    const body = document.body;
    const themeBtn = document.getElementById('themeBtn');

    if (localStorage.getItem('darkMode') === 'enabled') {
        body.classList.add('dark-mode');
    }

    themeBtn?.addEventListener('click', () => {
        const activo = body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', activo ? 'enabled' : 'disabled');
        if (themeBtn) {
            themeBtn.innerHTML = activo
                ? '<i class="fa-solid fa-sun"></i>'
                : '<i class="fa-solid fa-moon"></i>';
        }
    });
}


/* =============================================================================
   SIDEBAR MÓVIL
   ============================================================================= */

/**
 * Inicializa el toggle del sidebar en pantallas pequeñas.
 * Crea el overlay si no existe y lo gestiona con clases CSS.
 */
function initSidebarMobile() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Crear overlay si no existe
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    function toggleSidebar(forzarCerrar = false) {
        const abierto = sidebar.classList.contains('active');
        if (forzarCerrar || abierto) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        } else {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            document.body.classList.add('sidebar-open');
        }
    }

    menuToggle?.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });
    overlay.addEventListener('click', () => toggleSidebar(true));

    // Cerrar al navegar en móvil
    sidebar.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 992) toggleSidebar(true);
        });
    });

    // Cerrar al hacer resize a pantalla grande
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992) toggleSidebar(true);
    });
}


/* =============================================================================
   NOTIFICACIONES
   ============================================================================= */

/**
 * Al hacer clic en el botón de campana (#notifToggle):
 * - Marca todas las notificaciones como leídas en el backend
 * - Oculta el badge con animación
 */
function initNotifications() {
    const btn = document.getElementById('notifToggle');
    if (!btn) return;

    /* Crear el panel dropdown si no existe en el HTML */
    let panel = document.getElementById('notifDropdown');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notifDropdown';
        panel.style.cssText = `
            display:none; position:fixed; width:340px; max-height:420px;
            overflow-y:auto; background:#fff; border:1px solid #e2e8f0; border-radius:12px;
            box-shadow:0 8px 24px rgba(0,0,0,0.12); z-index:9999; padding:0;`;
        panel.innerHTML = `
            <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:.9rem;color:#1a202c">Notificaciones</strong>
                <button id="markAllRead" style="font-size:.78rem;color:#005F73;background:none;border:none;cursor:pointer;">Marcar leídas</button>
            </div>
            <div id="notifDropdownList" style="padding:8px 0;">
                <p style="text-align:center;padding:20px;color:#94a3b8;font-size:.85rem">Cargando...</p>
            </div>`;
        document.body.appendChild(panel);
    }

    let isOpen = false;

    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        if (!isOpen) { panel.style.display = 'none'; return; }

        if (isOpen) {
            const rect = btn.getBoundingClientRect();
            panel.style.top = (rect.bottom + 8) + 'px';
            panel.style.right = (window.innerWidth - rect.right) + 'px';
            panel.style.display = 'block';
            /* Cargar notificaciones */
            const lista = document.getElementById('notifDropdownList');
            try {
                const res = await apiFetch('/notificaciones');
                if (res?.ok) {
                    const notifs = await res.json();
                    if (!notifs.length) {
                        lista.innerHTML = '<p style="text-align:center;padding:20px;color:#94a3b8;font-size:.85rem">Sin notificaciones nuevas 🎉</p>';
                    } else {
                        const iconMap = {
                            transfer_sent: 'fa-arrow-up', transfer_received: 'fa-arrow-down',
                            loan_disbursed: 'fa-landmark', loan_payment: 'fa-receipt',
                            payment: 'fa-credit-card'
                        };
                        lista.innerHTML = notifs.slice(0, 10).map(n => {
                            const ic = iconMap[n.type] || 'fa-bell';
                            const dt = n.fecha ? new Date(n.fecha).toLocaleString('es-CO',
                                { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                            return `<div style="display:flex;gap:10px;padding:10px 16px;border-bottom:1px solid #f1f5f9;background:${n.read ? '#fff' : '#f0f9ff'};">
                                <div style="width:32px;height:32px;border-radius:50%;background:#005F73;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                    <i class="fa-solid ${ic}" style="color:#fff;font-size:.75rem"></i></div>
                                <div style="flex:1;min-width:0;">
                                    <div style="font-size:.82rem;font-weight:600;color:#1a202c">${n.titulo || 'Notificación'}</div>
                                    <div style="font-size:.78rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.mensaje || ''}</div>
                                    <div style="font-size:.72rem;color:#94a3b8;margin-top:2px">${dt}</div>
                                </div></div>`;
                        }).join('');
                    }
                    /* Marcar como leídas en backend */
                    apiFetch('/notificaciones/marcar-leidas', { method: 'POST' }).catch(() => { });
                    const badge = document.querySelector('.notif-badge');
                    if (badge) badge.style.display = 'none';
                }
            } catch {
                lista.innerHTML = '<p style="text-align:center;padding:16px;color:#ef4444;font-size:.85rem">Error al cargar</p>';
            }

            /* Marcar leídas btn */
            document.getElementById('markAllRead')?.addEventListener('click', () => {
                panel.style.display = 'none'; isOpen = false;
            });
        }
    });

    /* Cerrar al hacer clic fuera */
    document.addEventListener('click', (e) => {
        if (isOpen && !panel.contains(e.target) && e.target !== btn) {
            panel.style.display = 'none';
            isOpen = false;
        }
    });
}


/* =============================================================================
   BÚSQUEDA GLOBAL EN TABLAS
   ============================================================================= */

/**
 * Filtra filas de cualquier <table> visible según el texto en .search-input.
 * Opera en tiempo real mientras el usuario escribe.
 */
function initGlobalSearch() {
    const input = document.querySelector('.search-input');
    input?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll('table tbody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
        });
    });
}


/* =============================================================================
   ACCIONES GENÉRICAS POR ATRIBUTO data-*
     data-trigger="idInput"   → abre el input (archivo) con ese id
     data-action="print"      → window.print()
     data-action="reload"     → window.location.reload()
     data-nav="url.html"      → navega a la URL indicada
   ============================================================================= */
function initGenericUIActions() {
    /* Delegación real en document: cubre tanto los elementos ya presentes al
       cargar la página como los que páginas/JS añaden después dinámicamente
       (tablas, listas, modales generados por innerHTML). */
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-trigger]');
        if (trigger) { document.getElementById(trigger.dataset.trigger)?.click(); return; }

        const printBtn = e.target.closest('[data-action="print"]');
        if (printBtn) { window.print(); return; }

        const reloadBtn = e.target.closest('[data-action="reload"]');
        if (reloadBtn) { window.location.reload(); return; }

        const navEl = e.target.closest('[data-nav]');
        if (navEl) { window.location.href = navEl.dataset.nav; return; }
    });
}


/* =============================================================================
   EXPORTACIÓN DE ARCHIVOS
   ============================================================================= */

function initExportButtons() {
    if (window.location.pathname.includes('reportes-financieros')) return;

    document.getElementById('btnExportPDF')?.addEventListener('click', async () => {
        mostrarToast('⬇️ Generando historial PDF...', 'info');
        await descargarArchivo('/exportar/pdf', 'historial-bankomunal.html');
        mostrarToast('✅ Descargado. Ábrelo en el navegador y usa Ctrl+P → Guardar como PDF.', 'success');
    });
    document.getElementById('btnExportExcel')?.addEventListener('click', async () => {
        mostrarToast('⬇️ Generando Excel...', 'info');
        await descargarArchivo('/exportar/excel', 'historial-bankomunal.xlsx');
        mostrarToast('✅ Archivo Excel descargado correctamente.', 'success');
    });
    document.getElementById('btnExportCSV')?.addEventListener('click', async () => {
        mostrarToast('⬇️ Generando CSV...', 'info');
        await descargarArchivo('/exportar/excel', 'historial-bankomunal.csv');
        mostrarToast('✅ Archivo CSV descargado correctamente.', 'success');
    });
}


/* =============================================================================
   UTILIDADES COMPARTIDAS
   ============================================================================= */

/**
 * Formatea un número como moneda colombiana (COP).
 * @param {number} valor
 * @returns {string}  Ej: "$ 1.250.000"
 */
function formatearCOP(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor || 0);
}

/**
 * Muestra un toast de notificación en la esquina inferior derecha.
 * @param {string} mensaje
 * @param {'success'|'error'|'warning'|'info'} tipo
 */
function mostrarToast(mensaje, tipo = 'success') {
    const colores = {
        success: '#0A9396',
        error: '#ae2012',
        warning: '#ca6702',
        info: '#005F73'
    };

    const toast = document.createElement('div');
    toast.className = 'bk-toast';
    toast.textContent = mensaje;
    toast.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        background:${colores[tipo] || colores.info}; color:#fff;
        padding:12px 20px; border-radius:8px; font-size:14px;
        box-shadow:0 4px 16px rgba(0,0,0,.2); max-width:340px;
        animation:bkToastIn .3s ease; pointer-events:none;`;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity .4s';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Aplica máscara de formato monetario colombiano a un input mientras escribe.
 * @param {string} id  ID del elemento input
 */
function setupMoneyInput(id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', function () {
        const raw = this.value.replace(/\D/g, '');
        const num = parseInt(raw) || 0;
        this.value = num > 0 ? num.toLocaleString('es-CO') : '';
    });
}

/**
 * Muestra estado de carga en el tbody de una tabla.
 * @param {HTMLElement} tbody
 * @param {number}      cols  Número de columnas
 */
function mostrarCargandoTabla(tbody, cols = 5) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="td-loading">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>`;
}

/**
 * Muestra un mensaje de error en el tbody de una tabla.
 * @param {HTMLElement} tbody
 * @param {string}      mensaje
 * @param {number}      cols
 */
function mostrarErrorTabla(tbody, mensaje = 'Error al cargar datos', cols = 5) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="td-loading text-error">
        ⚠️ ${mensaje}</td></tr>`;
}

/**
 * Muestra un mensaje de lista vacía en el tbody de una tabla.
 * @param {HTMLElement} tbody
 * @param {string}      mensaje
 * @param {number}      cols
 */
function mostrarVacioTabla(tbody, mensaje = 'Sin registros', cols = 5) {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="td-loading text-muted-sm">
        ${mensaje}</td></tr>`;
}


/* =============================================================================
   BADGE DE NOTIFICACIONES — muestra conteo de no leídas sobre la campana
   Se llama en DOMContentLoaded desde el bloque principal de inicialización.
   ============================================================================= */
async function cargarBadgeNotificaciones() {
    const badge = document.getElementById('notifCount');
    if (!badge) return;
    try {
        const res = await apiFetch('/notificaciones');
        if (!res?.ok) return;
        const notifs = await res.json();
        const noLeidas = Array.isArray(notifs)
            ? notifs.filter(n => !n.leida).length
            : 0;
        if (noLeidas > 0) {
            badge.textContent = noLeidas > 99 ? '99+' : noLeidas;
            badge.classList.remove('hidden');
            badge.style.display = 'flex';
        } else {
            badge.textContent = '';
            badge.classList.add('hidden');
            badge.style.display = 'none';
        }
    } catch {
        /* sin conexión — ocultar badge silenciosamente */
    }
}
