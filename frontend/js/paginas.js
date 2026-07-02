/**
 * =============================================================================
 * Paginas
 * cuentas, perfil, configuración,
 * tarjeta virtual, préstamos y notificaciones push.
 * =============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;

    if (path.includes('cuentas')) initPaginaCuentas();
    if (path.includes('perfil')) await initPaginaPerfil();
    if (path.includes('configuracion')) await initPaginaConfiguracion();
    if (path.includes('tarjetavirtual')) initPaginaTarjeta();
    if (path.includes('prestamos')) initPaginaPrestamos();
    if (path.includes('transferencias')) initPaginaTransferencias();
    if (path.includes('pagos')) initPaginaPagos();

    /* WebSocket para notificaciones push en TODAS las páginas */
    initNotificacionesPush();
});


/* =============================================================================
   CUENTAS — saldo, QR, movimientos, transferencia rápida
   ============================================================================= */
async function initPaginaCuentas() {
    try {
        const res = await apiFetch('/cuentas');
        if (!res?.ok) throw new Error();
        const cuentas = await res.json();

        if (!cuentas.length) {
            mostrarToast('No tienes cuentas activas', 'warning');
            return;
        }

        const cuenta = cuentas[0];

        /* ── Mostrar número y saldo ───────────────────────────────────────── */
        const numEl = document.getElementById('numeroCuentaDisplay');
        const saldoEl = document.getElementById('saldoAhorros');
        const saldoDisplayEl = document.getElementById('saldoDisplay');
        if (numEl) numEl.textContent = cuenta.numero || 'BK-000000000';
        if (saldoEl) saldoEl.textContent = formatearCOP(cuenta.saldo || 0);
        if (saldoDisplayEl) saldoDisplayEl.textContent = formatearCOP(cuenta.saldo || 0);

        /* ── QR de recepción ─────────────────────────────────────────────── */
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            const qrText = `bankomunal://pagar?cuenta=${cuenta.numero}&titular=${getSession().nombre || ''}`;
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: qrText, width: 180, height: 180,
                    colorDark: '#005F73', colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrText)}&size=180x180&color=005F73" alt="QR">`;
            }
        }

        /* ── Descargar QR ────────────────────────────────────────────────── */
        document.getElementById('btnDescargarQR')?.addEventListener('click', () => {
            const canvas = document.querySelector('#qrcode canvas');
            const img = document.querySelector('#qrcode img');
            if (canvas) {
                const a = document.createElement('a');
                a.download = 'qr-bankomunal.png';
                a.href = canvas.toDataURL('image/png');
                a.click();
            } else if (img) {
                const a = document.createElement('a');
                a.download = 'qr-bankomunal.png';
                a.href = img.src;
                a.click();
            }
            mostrarToast('QR guardado ✅', 'success');
        });

        /* ── Copiar número de cuenta ─────────────────────────────────────── */
        document.getElementById('btnCopiarCuenta')?.addEventListener('click', () => {
            navigator.clipboard.writeText(cuenta.numero || '')
                .then(() => mostrarToast('Número copiado ✓', 'success'))
                .catch(() => mostrarToast('No se pudo copiar', 'error'));
        });

        /* ── Movimientos recientes ───────────────────────────────────────── */
        await cargarMovimientosCuenta();

        /* ── Filtros de movimientos ──────────────────────────────────────── */
        document.querySelectorAll('.filter-tab, [data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab, [data-filter]')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filtro = btn.dataset.filter || btn.textContent.trim().toLowerCase();
                filtrarMovimientos(filtro);
            });
        });

    } catch {
        mostrarToast('Error al cargar datos de la cuenta', 'error');
    }
}

let _movimientosCache = [];

async function cargarMovimientosCuenta() {
    const tbody = document.getElementById('listaMovimientosCuentas');
    if (!tbody) return;
    mostrarCargandoTabla(tbody, 4);
    try {
        const res = await apiFetch('/movimientos');
        if (!res?.ok) throw new Error();
        _movimientosCache = await res.json();
        renderMovimientosCuenta(_movimientosCache);
    } catch {
        mostrarErrorTabla(tbody, 'Error al cargar movimientos', 4);
    }
}

function filtrarMovimientos(filtro) {
    if (filtro === 'todos' || filtro === 'all') {
        renderMovimientosCuenta(_movimientosCache);
    } else if (filtro === 'ingresos') {
        renderMovimientosCuenta(_movimientosCache.filter(m =>
            ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo)));
    } else {
        renderMovimientosCuenta(_movimientosCache.filter(m =>
            !['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo)));
    }
}

function renderMovimientosCuenta(movimientos) {
    const tbody = document.getElementById('listaMovimientosCuentas');
    if (!tbody) return;
    if (!movimientos.length) {
        mostrarVacioTabla(tbody, 'Sin movimientos', 4); return;
    }
    const tipoLabel = {
        deposit: 'Depósito', withdrawal: 'Retiro', transfer: 'Transferencia',
        transfer_received: 'Transf. recibida', loan_disbursement: 'Desembolso',
        loan_payment: 'Pago Préstamo', fee: 'Servicio'
    };

    /* Actualizar KPIs de cuentas.html */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const ingresos = movimientos.filter(m => ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo));
    const egresos = movimientos.filter(m => !['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo));
    set('kpiIngresosHoy', formatearCOP(ingresos.reduce((s, m) => s + Math.abs(m.monto || 0), 0)));
    set('kpiEgresosHoy', formatearCOP(egresos.reduce((s, m) => s + Math.abs(m.monto || 0), 0)));
    set('kpiNumMovs', movimientos.length);

    tbody.innerHTML = movimientos.slice(0, 20).map(m => {
        const esIng = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
        const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : '-';
        return `<tr>
            <td><span class="status-pill ${esIng ? 'st-success' : 'st-danger'}" style="font-size:.72rem">${tipoLabel[m.tipo] || m.tipo}</span></td>
            <td>${m.descripcion || '-'}</td>
            <td style="color:var(--text-muted);font-size:.82rem">${fecha}</td>
            <td style="text-align:right;font-weight:700;color:${esIng ? '#16a34a' : '#dc2626'}">
                ${esIng ? '+' : '-'}${formatearCOP(m.monto)}</td>
        </tr>`;
    }).join('');
}


/* =============================================================================
   PERFIL — cargar datos, editar, cambiar foto, cambiar contraseña
   ============================================================================= */
async function initPaginaPerfil() {
    const session = getSession();
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    const txt = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };

    /* Poblar hero + form con datos de sesión inmediatamente */
    txt('displayNombre', session.nombre || 'Usuario');
    txt('profileNombre', session.nombre || 'Usuario');
    txt('profileEmail', session.email || '');
    txt('profileRol', session.rol || 'Socio');
    txt('profileMiembro', session.fechaRegistro
        ? 'Miembro desde ' + new Date(session.fechaRegistro).getFullYear()
        : 'Miembro activo');

    const heroAv = document.getElementById('profileAvatarDisplay');
    if (heroAv && !session.fotoUrl) heroAv.textContent = (session.nombre || '--').substring(0, 2).toUpperCase();

    set('inputNombre', session.nombre || '');
    set('inputEmail', session.email || '');
    set('perfilNombre', session.nombre || '');
    set('perfilApellido', session.apellido || '');
    set('perfilEmail', session.email || '');
    set('perfilTelefono', session.telefono || '');
    set('perfilCedula', session.cedula || '');
    set('perfilCiudad', session.ciudad || '');
    set('perfilDireccion', session.direccion || '');

    /* ── Intentar cargar datos frescos desde backend ─────────────────────── */
    try {
        const res = await apiFetch('/usuarios/perfil');
        if (res?.ok) {
            const data = await res.json();
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
            const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
            setTxt('displayNombre', data.nombre || session.nombre);
            setTxt('profileNombre', data.nombre || session.nombre);
            setTxt('profileEmail', data.email || session.email);
            setTxt('displayCiudad', data.ciudad || 'Colombia');
            set('inputNombre', data.nombre || '');
            set('inputEmail', data.email || '');
            set('inputTel', data.telefono || '');
            set('inputAddress', data.direccion || '');
            set('perfilNombre', data.nombre || '');
            set('perfilApellido', data.apellido || '');
            set('perfilEmail', data.email || '');
            set('perfilTelefono', data.telefono || '');
            set('perfilCedula', data.cedula || '');
            set('perfilCiudad', data.ciudad || '');
            set('perfilDireccion', data.direccion || '');

            if (data.createdAt) {
                const anio = new Date(data.createdAt).getFullYear();
                setTxt('profileMiembro', 'Miembro desde ' + anio);
            }

            if (data.fotoUrl) {
                aplicarFotoEnPagina(data.fotoUrl);

                const s = getSession();
                s.nombre = data.nombre || s.nombre;
                s.fotoUrl = data.fotoUrl || s.fotoUrl;
                localStorage.setItem('userSession', JSON.stringify(s));
            } else {

                const s = getSession();
                s.nombre = data.nombre || s.nombre;
                localStorage.setItem('userSession', JSON.stringify(s));
                const heroAv2 = document.getElementById('profileAvatarDisplay');
                if (heroAv2 && !heroAv2.querySelector('img'))
                    heroAv2.textContent = (data.nombre || session.nombre || 'U').substring(0, 2).toUpperCase();
            }
        }
    } catch { /* Usar datos de sesión */ }

    /* ── Cargar KPIs del perfil en paralelo ─────────────────────────────── */
    // Se inicializa en 0 y se carga desde educacion.js si está disponible.
    const pfSet = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    pfSet('pfKpiCursos', 0); // default; educacion.js lo actualiza si está cargado
    try {
        const [resCuentas, resPrestamos, resMovs] = await Promise.allSettled([
            apiFetch('/cuentas'),
            apiFetch('/prestamos/mis-prestamos'),
            apiFetch('/movimientos?limit=50')
        ]);
        if (resCuentas.status === 'fulfilled' && resCuentas.value?.ok) {
            const cuentas = await resCuentas.value.json();
            pfSet('pfKpiSaldo', formatearCOP(cuentas.reduce((s, c) => s + (c.saldo || 0), 0)));
        }
        if (resPrestamos.status === 'fulfilled' && resPrestamos.value?.ok) {
            const pres = await resPrestamos.value.json();
            pfSet('pfKpiCreditos', pres.filter(p => p.estado === 'active' || p.estado === 'ACTIVE').length);
        }
        if (resMovs.status === 'fulfilled' && resMovs.value?.ok) {
            const movs = await resMovs.value.json();
            pfSet('pfKpiTx', movs.length);

            /* Actividad reciente */
            const actDiv = document.getElementById('profileActividad');
            if (actDiv && movs.length) {
                actDiv.innerHTML = movs.slice(0, 8).map(m => {
                    const esIng = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
                    const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '';
                    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.65rem 0;border-bottom:1px solid var(--border)">
                        <div style="width:32px;height:32px;border-radius:9px;background:${esIng ? '#d1fae5' : '#fee2e2'};color:${esIng ? '#065f46' : '#b91c1c'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.8rem">
                            <i class="fa-solid ${esIng ? 'fa-arrow-down' : 'fa-arrow-up'}"></i></div>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:.83rem;font-weight:600;color:var(--text-primary)">${m.descripcion || m.tipo || 'Movimiento'}</div>
                            <div style="font-size:.71rem;color:var(--text-muted)">${fecha}</div>
                        </div>
                        <div style="font-size:.84rem;font-weight:700;color:${esIng ? '#16a34a' : '#dc2626'}">${esIng ? '+' : '-'}${formatearCOP(m.monto)}</div>
                    </div>`;
                }).join('');
            }
        }
    } catch { /* silencioso — KPIs quedan en default */ }

    /* ── Avatar: mostrar foto guardada o iniciales ───────────────────────── */
    const BACKEND = 'http://localhost:8080';
    const avatarImg = document.getElementById('avatarImg');
    const avatarIniciales = document.getElementById('avatarIniciales');

    function aplicarFotoEnPagina(url) {

        const esAbsoluta = url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:');
        const urlAbs = esAbsoluta ? url : BACKEND + url;
        if (avatarImg) { avatarImg.src = urlAbs; avatarImg.style.display = 'block'; if (avatarIniciales) avatarIniciales.style.display = 'none'; }
        const preview = document.getElementById('avatarPreview');
        if (preview) { preview.style.backgroundImage = `url(${urlAbs})`; preview.style.backgroundSize = 'cover'; preview.style.backgroundPosition = 'center'; }
        /* avatar hero del nuevo perfil.html */
        const heroAv = document.getElementById('profileAvatarDisplay');
        if (heroAv) heroAv.innerHTML = `<img src="${urlAbs}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        document.querySelectorAll('#avatarUsuario, .avatar-circle.header-avatar').forEach(el => {
            el.style.backgroundImage = `url(${urlAbs})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; el.textContent = '';
        });
    }

    if (session.fotoUrl) aplicarFotoEnPagina(session.fotoUrl);

    /* ── Descartar cambios: recarga los datos guardados en el formulario ──── */
    document.getElementById('btnDescartarPerfil')?.addEventListener('click', () => {
        initPaginaPerfil();
    });

    /* ── Subir foto de perfil ────────────────────────────────────────────── */

    const btnFoto = document.getElementById('btnUploadPhoto');
    const inputFoto = document.getElementById('fotoInput');

    inputFoto?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => aplicarFotoEnPagina(ev.target.result);
        reader.readAsDataURL(file);

        if (btnFoto) btnFoto.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Subiendo...';

        try {
            const url = await subirFotoUsuario(file);
            /* Sustituir preview local por la URL definitiva del servidor */
            aplicarFotoEnPagina(url);
            mostrarToast('Foto de perfil actualizada ✅', 'success');
        } catch (err) {
            console.error('Error al subir la foto de perfil:', err);
            mostrarToast(err.message || 'Error al subir la foto', 'error');
            /* Revertir el preview local si la subida falló */
            if (session.fotoUrl) {
                aplicarFotoEnPagina(session.fotoUrl);
            } else {
                const heroAvErr = document.getElementById('profileAvatarDisplay');
                if (heroAvErr) heroAvErr.textContent = (session.nombre || '--').substring(0, 2).toUpperCase();
            }
        } finally {
            if (btnFoto) btnFoto.innerHTML = '<i class="fa-solid fa-camera"></i> Foto';
            inputFoto.value = ''; // reset para permitir subir el mismo archivo otra vez
        }
    });

    /* ── Guardar cambios de perfil — soporta id "perfilForm" y "formPerfil" ── */
    const formPerfilEl = document.getElementById('perfilForm') || document.getElementById('formPerfil');
    formPerfilEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnGuardarPerfil');
        const payload = {
            nombre: (document.getElementById('inputNombre') || document.getElementById('perfilNombre'))?.value?.trim(),
            apellido: document.getElementById('perfilApellido')?.value?.trim() || '',
            email: (document.getElementById('inputEmail') || document.getElementById('perfilEmail'))?.value?.trim(),
            telefono: (document.getElementById('inputTel') || document.getElementById('perfilTelefono'))?.value?.trim(),
            direccion: (document.getElementById('inputAddress') || document.getElementById('perfilDireccion'))?.value?.trim(),
            cedula: document.getElementById('perfilCedula')?.value?.trim(),
            ciudad: document.getElementById('perfilCiudad')?.value?.trim()
        };
        if (!payload.nombre) return mostrarToast('El nombre es obligatorio', 'warning');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...'; }
        try {
            const res = await apiFetch('/usuarios/perfil', { method: 'PUT', body: JSON.stringify(payload) });
            if (res?.ok) {
                const s = getSession(); s.nombre = payload.nombre;
                localStorage.setItem('userSession', JSON.stringify(s));
                document.querySelectorAll('#nombreUsuario,#displayNombre,#profileNombre').forEach(el => el.textContent = payload.nombre);
                mostrarToast('Perfil actualizado ✅', 'success');
            } else mostrarToast('Error al actualizar perfil', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; } }
    });

    /* ── Cambiar contraseña ──────────────────────────────────────────────── */
    document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actual = document.getElementById('oldPassword')?.value;
        const nueva = document.getElementById('newPassword')?.value;
        const confirma = document.getElementById('confirmPassword')?.value;
        if (!actual || !nueva) return mostrarToast('Completa todos los campos', 'warning');
        if (nueva !== confirma) return mostrarToast('Las contraseñas no coinciden', 'warning');
        if (nueva.length < 8) return mostrarToast('Mínimo 8 caracteres', 'warning');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const res = await apiFetch('/usuarios/cambiar-password', {
                method: 'POST', body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
            });
            if (res?.ok) {
                mostrarToast('Contraseña actualizada ✅. Inicia sesión de nuevo...', 'success');
                e.target.reset();
                /* El backend invalida el token activo al cambiar la contraseña.
                   Cerramos sesión limpiamente para evitar errores 401 posteriores. */
                setTimeout(() => cerrarSesion(), 2500);
            } else { const d = await res.json(); mostrarToast(d.mensaje || 'Error al cambiar contraseña', 'error'); }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Actualizar Contraseña'; }
    });

    /* ── Toggles: cargar estado real desde backend y sincronizar al cambiar ─ */
    async function guardarConfigToggle(campo, valor) {
        try {
            await apiFetch('/usuarios/configuracion', {
                method: 'PUT',
                body: JSON.stringify({ [campo]: valor })
            });
        } catch { /* Silencioso — no crítico */ }
    }

    /* Cargar estado actual de preferencias al abrir la página */
    try {
        const resCfg = await apiFetch('/usuarios/configuracion');
        if (resCfg?.ok) {
            const prefs = await resCfg.json();
            const setChk = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.checked = !!v; };
            setChk('notifEmail', prefs.notifEmail);
            setChk('notifWhatsapp', prefs.notifSms);
            /* twoFactorToggle refleja si mfaCode === 'MFA_ENABLED' */
        }
    } catch { /* usa valores por defecto del HTML */ }

    document.getElementById('notifEmail')?.addEventListener('change', function () {
        guardarConfigToggle('notifEmail', this.checked);
        mostrarToast(`Notificaciones por email ${this.checked ? 'activadas' : 'desactivadas'}`, 'info');
    });

    document.getElementById('notifWhatsapp')?.addEventListener('change', function () {
        guardarConfigToggle('notifWhatsapp', this.checked);
        mostrarToast(`Alertas de WhatsApp ${this.checked ? 'activadas' : 'desactivadas'}`, 'info');
    });

    document.getElementById('twoFactorToggle')?.addEventListener('change', function () {
        guardarConfigToggle('mfaEnabled', this.checked);
        mostrarToast(`2FA ${this.checked ? 'activado ✅' : 'desactivado'}`, this.checked ? 'success' : 'warning');
    });
}


/* =============================================================================
   CONFIGURACIÓN — tabs + formularios por sección
   ============================================================================= */
async function initPaginaConfiguracion() {
    /* ── Poblar KPIs y previews del header de configuracion.html ──────────── */
    const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
    const config2fa = document.getElementById('status-2fa');
    const kpi2fa = document.getElementById('kpi2FA');

    // Preview de nombre/email/foto en el avatar del tab Perfil — se declaran
    // a nivel de función (no dentro del try de abajo) para que el listener
    // de subida de foto, más adelante, también pueda usarlos.
    const nombrePreview = document.getElementById('nombrePreview');
    const emailPreview = document.getElementById('emailPreview');
    const avatarPreview = document.getElementById('avatarPreview');

    /* Helper para aplicar foto en el avatar de configuración */
    function aplicarFotoCfg(fotoUrl) {
        if (!avatarPreview) return;
        if (fotoUrl) {
            const urlAbs = urlFotoAbsoluta(fotoUrl);
            avatarPreview.innerHTML = `<img src="${urlAbs}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
        } else {
            avatarPreview.style.backgroundImage = '';
            avatarPreview.innerHTML = '';
            avatarPreview.textContent = (sess.nombre || 'U').charAt(0).toUpperCase();
        }
    }

    function pintarMiembroDesde(fechaISO) {
        if (!fechaISO) { set('kpiMiembro', '—'); return; }
        const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86400000);
        if (dias <= 0) set('kpiMiembro', 'Hoy');
        else if (dias === 1) set('kpiMiembro', '1 día');
        else if (dias > 365) set('kpiMiembro', Math.floor(dias / 365) + ' año(s)');
        else set('kpiMiembro', dias + ' días');
    }

    try {

        pintarMiembroDesde(sess.createdAt);
        set('kpiRol', (sess.rol || 'Socio').charAt(0).toUpperCase() + (sess.rol || 'Socio').slice(1).toLowerCase());
        set('kpiSesiones', '1 activa');

        const isMfa = sess.mfaEnabled === true || sess.mfaCode === 'MFA_ENABLED';
        /* Estado 2FA inicial desde sesión — se sobreescribe con backend más abajo */
        if (config2fa) config2fa.innerHTML = isMfa
            ? '<i class="fa-solid fa-shield-check" style="color:#16a34a"></i> <strong style="color:#16a34a">Activado</strong> — tu cuenta está protegida'
            : '<i class="fa-solid fa-shield-halved" style="color:#d97706"></i> <span style="color:#d97706">No activado</span> — recomendamos activarlo';
        if (kpi2fa) kpi2fa.textContent = isMfa ? ' Activo' : ' Inactivo';

        // Preview de nombre/email en el avatar del tab Perfil
        if (nombrePreview) nombrePreview.textContent = sess.nombre || '—';
        if (emailPreview) emailPreview.textContent = sess.email || '—';

        aplicarFotoCfg(sess.fotoUrl);

        // Pre-fill form fields from session (se sobreescriben con datos frescos del perfil más abajo)
        const cfgNombre = document.getElementById('config-nombre');
        const cfgEmail = document.getElementById('config-email');
        const cfgTel = document.getElementById('config-telefono');
        const cfgCiudad = document.getElementById('config-ciudad');
        if (cfgNombre) cfgNombre.value = sess.nombre || '';
        if (cfgEmail) cfgEmail.value = sess.email || '';
        if (cfgTel) cfgTel.value = sess.telefono || '';
        if (cfgCiudad) cfgCiudad.value = sess.ciudad || '';

        // Idioma: el backend no lo persiste (es preferencia local del navegador)
        const cfgIdioma = document.getElementById('config-idioma');
        if (cfgIdioma) cfgIdioma.value = localStorage.getItem('bkm_idioma') || 'es';

        /* Perfil fresco — fuente confiable para "miembro desde" y foto */
        const resPerfil = await apiFetch('/usuarios/perfil');
        if (resPerfil?.ok) {
            const perfil = await resPerfil.json();
            pintarMiembroDesde(perfil.createdAt);
            if (cfgTel && perfil.telefono) cfgTel.value = perfil.telefono;
            if (cfgCiudad && perfil.ciudad) cfgCiudad.value = perfil.ciudad;
            if (cfgNombre && perfil.nombre) cfgNombre.value = perfil.nombre;
            if (cfgEmail && perfil.email) cfgEmail.value = perfil.email;

            if (perfil.fotoUrl) {
                aplicarFotoCfg(perfil.fotoUrl);
                if (nombrePreview) nombrePreview.textContent = perfil.nombre || sess.nombre || '—';
                if (emailPreview) emailPreview.textContent = perfil.email || sess.email || '—';
                /* Persistir en sesión */
                const s = getSession();
                s.fotoUrl = perfil.fotoUrl;
                s.nombre = perfil.nombre || s.nombre;
                localStorage.setItem('userSession', JSON.stringify(s));
            }
        }
    } catch (e) { console.warn('Error al inicializar header de configuración:', e); }

    /* ── Subir foto de perfil ──*/
    const fotoInputCfg = document.getElementById('fotoInput');
    fotoInputCfg?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        /* Preview local inmediato */
        const reader = new FileReader();
        reader.onload = ev => {
            if (avatarPreview) avatarPreview.innerHTML =
                `<img src="${ev.target.result}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
        };
        reader.readAsDataURL(file);

        try {
            const url = await subirFotoUsuario(file);
            aplicarFotoCfg(url);
            mostrarToast('Foto de perfil actualizada ✅', 'success');
        } catch (err) {
            console.error('Error al subir la foto de perfil:', err);
            mostrarToast(err.message || 'Error al subir la foto', 'error');
            /* Revertir el preview local si la subida falló */
            aplicarFotoCfg(sess.fotoUrl);
        } finally {
            fotoInputCfg.value = '';
        }
    });

    /* ── Sistema de tabs con .config-tab y .tab-pane ─────────────────────── */
    const tabs = document.querySelectorAll('.config-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const pane = document.getElementById('tab-' + target);
            if (pane) pane.classList.add('active');
        });
    });

    /* ── Cargar preferencias reales desde el backend (checkboxes) ─────── */
    try {
        const res = await apiFetch('/usuarios/configuracion');
        if (res?.ok) {
            const prefs = await res.json();
            const setChk = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.checked = !!v; };
            setChk('config-alerta-saldo', prefs.alertaSaldo);
            setChk('config-notif-email', prefs.notifEmail);
            setChk('config-notif-push', prefs.notifPush);
            setChk('config-notif-whatsapp', prefs.notifSms);
            if (prefs.mfaEnabled !== undefined) {
                const mfaOn = prefs.mfaEnabled === true;
                if (config2fa) config2fa.innerHTML = mfaOn
                    ? '<i class="fa-solid fa-shield-check" style="color:#16a34a"></i> <strong style="color:#16a34a">Activado</strong> — tu cuenta está protegida'
                    : '<i class="fa-solid fa-shield-halved" style="color:#d97706"></i> <span style="color:#d97706">No activado</span> — recomendamos activarlo';
                if (kpi2fa) kpi2fa.textContent = mfaOn ? ' Activo' : ' Inactivo';
                /* Actualizar visibilidad botones si ya están en DOM */
                const btnA = document.getElementById('btnActivar2FA');
                const btnD = document.getElementById('btnDesactivar2FA');
                if (btnA) btnA.style.display = mfaOn ? 'none' : '';
                if (btnD) btnD.style.display = mfaOn ? '' : 'none';
            }
            /* Guardar en sesión para los toggles de perfil.html */
            const s = getSession();
            s.notifEmail = prefs.notifEmail;
            s.alertaSaldo = prefs.alertaSaldo;
            s.mfaEnabled = prefs.mfaEnabled;
            localStorage.setItem('userSession', JSON.stringify(s));
        }
    } catch { /* Silencioso — usa valores por defecto del HTML */ }

    /* ── Guardar perfil (tab Perfil) ─────────────────────────────────────── */
    document.getElementById('formConfigPerfil')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]') ||
            document.getElementById('btnGuardarPerfil');
        const payload = {
            nombre: document.getElementById('config-nombre')?.value?.trim(),
            email: document.getElementById('config-email')?.value?.trim(),
            telefono: document.getElementById('config-telefono')?.value?.trim(),
            ciudad: document.getElementById('config-ciudad')?.value?.trim()
        };
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
        try {
            const res = await apiFetch('/usuarios/perfil', { method: 'PUT', body: JSON.stringify(payload) });
            if (res?.ok) {
                const s = getSession();
                Object.assign(s, payload);
                localStorage.setItem('userSession', JSON.stringify(s));
                mostrarToast('Datos de perfil guardados ✅', 'success');
            } else mostrarToast('Error al guardar el perfil', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; } }
    });

    /* ── Guardar preferencias (tab Preferencias) ─────────────────────────── */
    document.getElementById('btnGuardarPrefs')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnGuardarPrefs');
        const idioma = document.getElementById('config-idioma')?.value || 'es';
        const prefs = {
            idioma,
            alertaSaldo: document.getElementById('config-alerta-saldo')?.checked ?? true,
            notifEmail: document.getElementById('config-notif-email')?.checked ?? true,
            notifPush: document.getElementById('config-notif-push')?.checked ?? true,
            notifSms: document.getElementById('config-notif-whatsapp')?.checked ?? false
        };
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
        try {
            const res = await apiFetch('/usuarios/configuracion', {
                method: 'PUT',
                body: JSON.stringify(prefs)
            });
            if (res?.ok) {
                localStorage.setItem('bkm_idioma', idioma);
                mostrarToast('Preferencias guardadas ✅', 'success');
            } else {
                mostrarToast('Error al guardar preferencias', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = 'Guardar Preferencias'; } }
    });

    /* ── Tab Sistema (solo admin) ─────────────────────────────────────────── */
    (function initTabSistema() {
        const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
        const esAdmin = sess.rol === 'admin' || sess.role === 'admin';
        if (!esAdmin) return;

        document.getElementById('tabSistemaBtn')?.classList.remove('hidden');

        (async () => {
            try {
                const res = await apiFetch('/admin/sistema');
                if (!res?.ok) return;
                const cfg = await res.json();
                document.getElementById('sis-nombre').value = cfg.nombreCooperativa ?? '';
                document.getElementById('sis-email').value = cfg.emailSoporte ?? '';
                document.getElementById('sis-tasa-min').value = cfg.tasaInteresMinima ?? '';
                document.getElementById('sis-tasa-max').value = cfg.tasaInteresMaxima ?? '';
                document.getElementById('sis-monto-max').value = cfg.montoMaximoPrestamo ?? '';
                document.getElementById('sis-plazo-max').value = cfg.plazoMaximoMeses ?? '';
                document.getElementById('sis-mantenimiento').checked = !!cfg.modoMantenimiento;
                document.getElementById('sis-registro').checked = cfg.registroHabilitado !== false;
                document.getElementById('sis-notif-admin').checked = cfg.notificacionesAdmin !== false;
            } catch { /* el formulario queda con los valores por defecto del HTML */ }
        })();

        document.getElementById('btnGuardarSistema')?.addEventListener('click', async () => {
            const btn = document.getElementById('btnGuardarSistema');
            const tasaMin = parseFloat(document.getElementById('sis-tasa-min').value);
            const tasaMax = parseFloat(document.getElementById('sis-tasa-max').value);
            if (isNaN(tasaMin) || isNaN(tasaMax) || tasaMin < 0 || tasaMax < tasaMin) {
                return mostrarToast('Revisa las tasas de interés: la mínima no puede ser mayor que la máxima.', 'warning');
            }
            const body = {
                nombreCooperativa: document.getElementById('sis-nombre').value.trim(),
                emailSoporte: document.getElementById('sis-email').value.trim(),
                tasaInteresMinima: tasaMin,
                tasaInteresMaxima: tasaMax,
                montoMaximoPrestamo: parseInt(document.getElementById('sis-monto-max').value, 10) || 0,
                plazoMaximoMeses: parseInt(document.getElementById('sis-plazo-max').value, 10) || 1,
                modoMantenimiento: document.getElementById('sis-mantenimiento').checked,
                registroHabilitado: document.getElementById('sis-registro').checked,
                notificacionesAdmin: document.getElementById('sis-notif-admin').checked,
            };
            btn.disabled = true; btn.textContent = 'Guardando...';
            try {
                const res = await apiFetch('/admin/sistema', { method: 'PUT', body: JSON.stringify(body) });
                if (res?.ok) mostrarToast('Configuración del sistema guardada ✅', 'success');
                else mostrarToast('Error al guardar la configuración', 'error');
            } catch { mostrarToast('Error de conexión', 'error'); }
            finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Configuración'; }
        });
    })();

    /* ── Cambiar contraseña desde tab Seguridad ──────────────────────────── */
    document.getElementById('formCambiarPass')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const actual = document.getElementById('passActual')?.value;
        const nueva = document.getElementById('passNueva')?.value;
        const confirma = document.getElementById('passConfirmar')?.value;
        const btn = e.target.querySelector('button[type="submit"]');

        if (!actual || !nueva) return mostrarToast('Completa todos los campos', 'warning');
        if (nueva !== confirma) return mostrarToast('Las contraseñas no coinciden', 'warning');
        if (nueva.length < 6) return mostrarToast('Mínimo 6 caracteres', 'warning');

        if (btn) btn.disabled = true;
        try {
            const res = await apiFetch('/usuarios/cambiar-password', {
                method: 'POST',
                body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
            });
            if (res?.ok) {
                mostrarToast('Contraseña actualizada ✅. Inicia sesión de nuevo...', 'success');
                e.target.reset();
                setTimeout(() => cerrarSesion(), 2500);
            } else {
                const d = await res.json().catch(() => ({}));
                mostrarToast(d.mensaje || 'Contraseña actual incorrecta', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = 'Actualizar Contraseña'; } }
    });

    /* Botón "Cambiar contraseña" que muestra/oculta la sección */
    document.getElementById('btnCambiarPass')?.addEventListener('click', () => {
        const s = document.getElementById('seccionPassword');
        if (s) s.classList.toggle('hidden');
        else window.location.href = 'perfil.html';
    });

    /* ── Gestionar 2FA — panel expandible con botones Activar/Desactivar ────*/
    const seccion2FA = document.getElementById('seccion2FA');
    const btnActivar2FA = document.getElementById('btnActivar2FA');
    const btnDesactivar2FA = document.getElementById('btnDesactivar2FA');

    function actualizarUI2FA(mfaOn) {
        if (config2fa) {
            config2fa.innerHTML = mfaOn
                ? '<i class="fa-solid fa-shield-check" style="color:#16a34a"></i> <strong style="color:#16a34a">Activado</strong> — tu cuenta está protegida'
                : '<i class="fa-solid fa-shield-halved" style="color:#d97706"></i> <span style="color:#d97706">No activado</span> — recomendamos activarlo';
        }
        if (kpi2fa) kpi2fa.textContent = mfaOn ? '✅ Activo' : '⚠️ Inactivo';
        /* Mostrar solo el botón correspondiente */
        if (btnActivar2FA) btnActivar2FA.style.display = mfaOn ? 'none' : '';
        if (btnDesactivar2FA) btnDesactivar2FA.style.display = mfaOn ? '' : 'none';
    }

    document.getElementById('btnGestionar2FA')?.addEventListener('click', () => {
        seccion2FA?.classList.toggle('hidden');
    });

    async function toggle2FA(activar) {
        const btn = activar ? btnActivar2FA : btnDesactivar2FA;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...'; }
        try {
            const res = await apiFetch('/usuarios/configuracion', {
                method: 'PUT',
                body: JSON.stringify({ mfaEnabled: activar })
            });
            if (res?.ok) {
                const data = await res.json();
                const mfaOn = data.mfaEnabled === true;
                actualizarUI2FA(mfaOn);
                const s = getSession(); s.mfaEnabled = mfaOn;
                localStorage.setItem('userSession', JSON.stringify(s));
                mostrarToast(mfaOn ? '🔒 2FA activado correctamente.' : '🔓 2FA desactivado.', 'success');
                seccion2FA?.classList.add('hidden');
            } else {
                mostrarToast('No se pudo actualizar la verificación en dos pasos.', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally {
            if (btnActivar2FA) { btnActivar2FA.disabled = false; btnActivar2FA.innerHTML = '<i class="fa-solid fa-lock"></i> Activar 2FA'; }
            if (btnDesactivar2FA) { btnDesactivar2FA.disabled = false; btnDesactivar2FA.innerHTML = '<i class="fa-solid fa-lock-open"></i> Desactivar 2FA'; }
        }
    }

    btnActivar2FA?.addEventListener('click', () => toggle2FA(true));
    btnDesactivar2FA?.addEventListener('click', () => toggle2FA(false));

    /* Inicializar estado visual del 2FA desde sesión  */
    actualizarUI2FA(sess.mfaEnabled === true || sess.mfaCode === 'MFA_ENABLED');

    /* ── Desactivar cuenta ───────────────────────────────────────────────── */
    document.getElementById('btnBorrarCuenta')?.addEventListener('click', async () => {
        if (!confirm('¿Seguro que deseas desactivar tu cuenta? Esta acción no se puede deshacer.')) return;
        try {
            const s = getSession();
            await apiFetch(`/usuarios/${s.id}/desactivar`, { method: 'PATCH' });
            mostrarToast('Cuenta desactivada. Redirigiendo...', 'warning');
            setTimeout(cerrarSesion, 2000);
        } catch { mostrarToast('Error al desactivar la cuenta', 'error'); }
    });
}


/* =============================================================================
   TARJETA VIRTUAL — carga datos reales del usuario
   ============================================================================= */
async function initPaginaTarjeta() {
    const session = getSession();

    /* ── Intentar obtener datos de cuenta del backend ────────────────────── */
    let saldoReal = 0;
    let cuentaIdReal = null;
    try {
        const res = await apiFetch('/cuentas');
        if (res?.ok) {
            const cuentas = await res.json();
            if (cuentas.length) {
                saldoReal = cuentas[0].saldo || 0;
                cuentaIdReal = cuentas[0].id || null;
            }
        }
    } catch { /* usa valores de sesión */ }

    const seed = session.id || 1;
    const holder = (session.nombre || 'TARJETA HABIENTE').toUpperCase();
    const expiry = generarVencimiento(seed);
    const cvv = generarCVV(seed);
    const saldo = formatearCOP(saldoReal || session.saldoTotal || 0);


    const seedTarjeta = cuentaIdReal || seed;
    const cardNum = generarNumeroTarjeta(seedTarjeta);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('cardHolderDisplay', holder);
    set('cardNumberDisplay', cardNum);
    set('cardExpiryDisplay', expiry);
    set('cardCvvDisplay', cvv);
    set('cardSaldoDisplay', saldo);
    set('detailHolder', holder);
    set('detailNumber', cardNum);
    set('detailExpiry', expiry);
    set('detailSaldo', saldo);
    set('tvKpiSaldo', saldo);
    set('tvKpiVence', expiry);
    set('tvKpiEstado', 'Activa');

    try {
        const resMovs = await apiFetch('/movimientos?limit=200');
        if (resMovs?.ok) {
            const movs = await resMovs.json();
            const ahora = new Date();
            const mesActual = ahora.getMonth();
            const anioActual = ahora.getFullYear();
            const tiposIngreso = ['deposit', 'loan_disbursement', 'transfer_received'];

            const gastosMes = movs
                .filter(m => {
                    if (!m.fecha) return false;
                    const f = new Date(m.fecha);
                    return f.getMonth() === mesActual && f.getFullYear() === anioActual
                        && !tiposIngreso.includes(m.tipo);
                })
                .reduce((sum, m) => sum + Math.abs(m.monto || 0), 0);

            set('tvKpiGastos', formatearCOP(gastosMes));
        } else {
            set('tvKpiGastos', formatearCOP(0));
        }
    } catch {
        set('tvKpiGastos', formatearCOP(0));
    }


    document.getElementById('cardFlip')?.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        e.currentTarget.classList.toggle('flipped');
    });

    document.getElementById('btnCopyNumber')?.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(cardNum.replace(/\s/g, ''))
            .then(() => mostrarToast('Número copiado al portapapeles ✓', 'success'));
    });

    document.getElementById('btnCopyCvv')?.addEventListener('click', e => {
        e.stopPropagation();
        navigator.clipboard.writeText(cvv)
            .then(() => mostrarToast('CVV copiado al portapapeles ✓', 'success'));
    });

    let congelada = false;
    document.getElementById('btnBloquear')?.addEventListener('click', () => {
        congelada = !congelada;
        const btn = document.getElementById('btnBloquear');
        const card = document.getElementById('cardFlip');
        const badge = document.getElementById('frozenBadge');
        const estado = document.getElementById('detailEstado');

        if (congelada) {
            btn.innerHTML = '<i class="fa-solid fa-unlock"></i> Descongelar Tarjeta';
            btn.style.background = '#dc2626';
            card?.classList.add('card-frozen');
            badge?.classList.remove('hidden');
            if (estado) estado.innerHTML = '<span class="status-badge status-error">Congelada</span>';
            mostrarToast('Tarjeta congelada. No se pueden realizar compras.', 'warning');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-lock"></i> Congelar Tarjeta';
            btn.style.background = '';
            card?.classList.remove('card-frozen');
            badge?.classList.add('hidden');
            if (estado) estado.innerHTML = '<span class="status-badge status-success">Activa</span>';
            mostrarToast('Tarjeta activada nuevamente.', 'success');
        }
    });

    document.getElementById('btnSolicitar')?.addEventListener('click', () => {
        mostrarToast('Disponible al conectar pasarela de pagos externa.', 'info');
    });

    document.getElementById('btnCompartir')?.addEventListener('click', () => {
        const texto = `Bankomunal\nTitular: ${holder}\nNúmero: ${cardNum}\nVence: ${expiry}`;
        if (navigator.share) {
            navigator.share({ title: 'Mi Tarjeta Bankomunal', text: texto }).catch(() => { });
        } else {
            navigator.clipboard.writeText(texto)
                .then(() => mostrarToast('Datos copiados al portapapeles ✓', 'success'));
        }
    });


    document.getElementById('btnQRCobrar')?.addEventListener('click', () => {
        const modal = document.getElementById('modalQRCobrar');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('active');

        const container = document.getElementById('qrCobrarCanvas');
        const label = document.getElementById('qrCobrarLabel');
        if (container) {
            const qrData = JSON.stringify({
                app: 'bankomunal', titular: holder,
                numero: cardNum.replace(/\s/g, ''), vence: expiry,
            });
            const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=005F73&data=' + encodeURIComponent(qrData);
            container.innerHTML = `<img src="${qrUrl}" alt="Código QR para cobrar" width="200" height="200" style="border-radius:8px">`;
        }
        if (label) label.textContent = holder + ' · ' + cardNum;
    });

    document.getElementById('closeModalQRCobrar')?.addEventListener('click', () => {
        const m = document.getElementById('modalQRCobrar');
        if (m) { m.classList.add('hidden'); m.classList.remove('active'); }
    });
    document.getElementById('modalQRCobrar')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
            e.currentTarget.classList.remove('active');
        }
    });

    document.getElementById('btnDescargarQR')?.addEventListener('click', async () => {
        const imgEl = document.querySelector('#qrCobrarCanvas img');
        if (!imgEl) return mostrarToast('Genera el QR primero', 'warning');

        try {
            const resp = await fetch(imgEl.src);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'qr-bankomunal.png';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            mostrarToast('QR descargado ✓', 'success');
        } catch {
            /* Si falla el fetch (ej. CORS), al menos abrir la imagen en pestaña nueva */
            window.open(imgEl.src, '_blank');
            mostrarToast('Abriendo QR en una nueva pestaña…', 'info');
        }
    });

    document.getElementById('btnQRPagar')?.addEventListener('click', () => {
        const m = document.getElementById('modalQRPagar');
        if (m) { m.classList.remove('hidden'); m.classList.add('active'); }
        // Iniciar escáner de cámara
        iniciarEscanerQR();
    });
    document.getElementById('closeModalQRPagar')?.addEventListener('click', () => {
        const m = document.getElementById('modalQRPagar');
        if (m) { m.classList.add('hidden'); m.classList.remove('active'); }
        detenerEscanerQR();
    });
    document.getElementById('modalQRPagar')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
            e.currentTarget.classList.remove('active');
            detenerEscanerQR();
        }
    });
}


/* =============================================================================
   QR SCANNER — Pagar con QR (tarjetavirtual.html)
   ============================================================================= */
let _qrScanner = null;

function iniciarEscanerQR() {
    const container = document.getElementById('qrPagarReader');
    const resultDiv = document.getElementById('qrPagarResult');
    if (!container) return;

    if (typeof Html5Qrcode === 'undefined') {
        if (container) container.innerHTML =
            '<p style="color:#fff;text-align:center;padding:2rem">Librería QR no disponible.<br>Verifica conexión a internet.</p>';
        return;
    }

    // Detener escáner previo si existe
    detenerEscanerQR();

    container.innerHTML = '';
    if (resultDiv) { resultDiv.style.display = 'none'; resultDiv.textContent = ''; }

    _qrScanner = new Html5Qrcode('qrPagarReader');
    _qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            // QR leído exitosamente
            detenerEscanerQR();
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `<i class="fa-solid fa-check-circle" style="color:var(--success,#22c55e)"></i>
                    <strong> QR leído:</strong> ${decodedText}<br>
                    <small style="color:var(--text-muted)">Procesando pago...</small>`;
            }
            // Intentar procesar el QR como número de cuenta
            procesarPagoQR(decodedText);
        },
        () => { /* scan en progreso, ignorar errores de frame */ }
    ).catch(err => {
        container.innerHTML = `<p style="color:#fff;text-align:center;padding:2rem">
            <i class="fa-solid fa-camera-slash" style="font-size:2rem;display:block;margin-bottom:.5rem"></i>
            No se pudo acceder a la cámara.<br>
            <small>Verifica los permisos del navegador.</small></p>`;
        console.error('QR scanner error:', err);
    });
}

function detenerEscanerQR() {
    if (_qrScanner) {
        _qrScanner.stop().catch(() => { });
        _qrScanner = null;
    }
}

async function procesarPagoQR(qrData) {
    // El QR puede contener un número de cuenta o JSON con datos de pago
    let numeroCuenta = qrData;
    try { const parsed = JSON.parse(qrData); numeroCuenta = parsed.cuenta || parsed.numeroCuenta || qrData; } catch { }

    const resultDiv = document.getElementById('qrPagarResult');
    try {
        // Aquí se integraría con el endpoint de transferencia por QR
        // Por ahora mostramos los datos del destinatario y pedimos confirmación
        mostrarToast(`QR leído: ${numeroCuenta}. Abre Transferencias para completar el pago.`, 'info');
        if (resultDiv) {
            resultDiv.innerHTML = `<i class="fa-solid fa-check-circle" style="color:var(--success,#22c55e)"></i>
                <strong> QR Detectado</strong><br>
                Cuenta destino: <code>${numeroCuenta}</code><br>
                <a href="transferencias.html" class="btn-primary" style="display:inline-block;margin-top:.6rem;font-size:.82rem;padding:.35rem .8rem">
                    <i class="fa-solid fa-paper-plane"></i> Ir a Transferencias
                </a>`;
        }
    } catch {
        mostrarToast('No se pudo procesar el código QR', 'error');
    }
}


/* =============================================================================
   PRÉSTAMOS — KPIs, lista activos, KPI ahorro
   ============================================================================= */
async function initPaginaPrestamos() {
    /* ── KPIs superiores ─────────────────────────────────────────────────── */
    try {
        const res = await apiFetch('/prestamos/mis-prestamos');
        if (!res?.ok) throw new Error();
        const data = await res.json();

        const activos = data.filter(p => p.estado === 'active' || p.estado === 'ACTIVE');
        const deuda = activos.reduce((s, p) => s + (p.saldoPendiente || 0), 0);
        const proxPago = activos.length ? formatearCOP(activos[0].cuotaMensual || 0) : '---';

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('deudaTotalDisplay', formatearCOP(deuda));
        set('proximoPagoDisplay', proxPago);
        set('kpiCreditosActivos', activos.length);
        const estadoLabel = {
            active: 'Activo', ACTIVE: 'Activo', pending: 'En revisión', PENDING: 'En revisión',
            approved: 'Aprobado', APPROVED: 'Aprobado', rejected: 'Rechazado', REJECTED: 'Rechazado',
            completed: 'Completado', COMPLETED: 'Completado', overdue: 'Vencido', OVERDUE: 'Vencido',
            approved: 'Aprobado', APPROVED: 'Aprobado', paid: 'Pagado', PAID: 'Pagado',
            rejected: 'Rechazado', REJECTED: 'Rechazado', defaulted: 'En mora', DEFAULTED: 'En mora'
        };
        const estadoClass = {
            active: 'badge-activo', ACTIVE: 'badge-activo', pending: 'badge-pendiente',
            PENDING: 'badge-pendiente', defaulted: 'badge-vencido', DEFAULTED: 'badge-vencido'
        };

        /* Lista de créditos activos */
        const tbody = document.getElementById('listaPrestamosActivos');
        if (tbody) {
            if (!data.length) {
                mostrarVacioTabla(tbody, 'No tienes créditos activos', 6);
            } else {
                tbody.innerHTML = data.map(p => {
                    const pagado = (p.montoSolicitado || 0) - (p.saldoPendiente || 0);
                    const pct = p.montoSolicitado ? Math.round((pagado / p.montoSolicitado) * 100) : 0;
                    const cls = estadoClass[p.estado] || 'badge-pendiente';
                    const lbl = estadoLabel[p.estado] || p.estado;
                    return `<tr>
                        <td><strong>#${p.id}</strong></td>
                        <td>${formatearCOP(p.montoSolicitado)}</td>
                        <td>${formatearCOP(p.saldoPendiente || 0)}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:.5rem;min-width:100px">
                                <div class="prog-bar" style="flex:1"><div class="prog-fill" style="width:${pct}%"></div></div>
                                <span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap">${pct}%</span>
                            </div>
                        </td>
                        <td><span class="${cls}">${lbl}</span></td>
                        <td style="text-align:right"><a href="detalle-prestamos.html?id=${p.id}" class="btn-link-sm">
                            <i class="fa-solid fa-eye"></i> Ver</a></td>
                    </tr>`;
                }).join('');
            }
        }
    } catch {
        const tbody = document.getElementById('listaPrestamosActivos');
        if (tbody) mostrarErrorTabla(tbody, 'Error al cargar préstamos', 6);
    }

    /* ── KPI Ahorro acumulado ────────────────────────────────────────────── */
    try {
        const res = await apiFetch('/cuentas');
        if (res?.ok) {
            const cuentas = await res.json();
            const ahorro = cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
            const el = document.getElementById('ahorroAcumuladoDisplay');
            if (el) el.textContent = formatearCOP(ahorro);
        }
    } catch { /* silencioso */ }

    /* ── Solicitar préstamo desde form ───────────────────────────────────── */
    document.getElementById('formSimularPrestamo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const monto = parseInt((document.getElementById('montoInput')?.value || '').replace(/\D/g, ''));
        const plazo = parseInt(document.getElementById('plazoSelect')?.value);
        if (!monto || monto < 100000) return mostrarToast('Monto mínimo $100.000', 'warning');

        // Calcular cuota para mostrar en el modal
        const tasas = { 6: 0.020, 12: 0.018, 24: 0.015 };
        const tasa = tasas[plazo] || 0.018;
        const cuota = monto * (tasa * Math.pow(1 + tasa, plazo)) / (Math.pow(1 + tasa, plazo) - 1);

        // Poblar y abrir modal de confirmación
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('mccMonto', formatearCOP(monto));
        set('mccPlazo', `${plazo} meses`);
        set('mccCuota', formatearCOP(cuota));

        const modal = document.getElementById('modalConfirmarCredito');
        if (modal) {
            modal.dataset.monto = monto;
            modal.dataset.plazo = plazo;
            modal.classList.remove('hidden');
            modal.classList.add('active');
        }
    });

    // Lógica del modal de confirmación de crédito
    const modalCC = document.getElementById('modalConfirmarCredito');
    const cerrarMCC = () => { modalCC?.classList.add('hidden'); modalCC?.classList.remove('active'); };

    document.getElementById('closeMCC')?.addEventListener('click', cerrarMCC);
    document.getElementById('btnCancelarCredito')?.addEventListener('click', cerrarMCC);
    modalCC?.addEventListener('click', e => { if (e.target === modalCC) cerrarMCC(); });

    document.getElementById('btnEnviarCredito')?.addEventListener('click', async () => {
        const monto = parseInt(modalCC?.dataset.monto);
        const plazo = parseInt(modalCC?.dataset.plazo);
        const btn = document.getElementById('btnEnviarCredito');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
        try {
            const res = await apiFetch('/prestamos', {
                method: 'POST', body: JSON.stringify({ montoSolicitado: monto, plazoMeses: plazo, motivo: 'App' })
            });
            const data = await res.json();
            if (res.ok) {
                cerrarMCC();
                mostrarToast('✅ Solicitud enviada. En revisión.', 'success');
                setTimeout(() => location.reload(), 1800);
            } else mostrarToast(data.mensaje || 'Error al solicitar', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Solicitud'; }
    });
}


/* =============================================================================
   TRANSFERENCIAS
   ============================================================================= */

async function initPaginaTransferencias() {

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    try {
        const res = await apiFetch('/movimientos?limit=20');
        if (!res?.ok) throw new Error();
        const movs = await res.json();


        const ahora = new Date();
        const esDelMesActual = m => {
            if (!m.fecha) return false;
            const f = new Date(m.fecha);
            return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        };
        const enviadosMes = movs.filter(m => m.tipo === 'transfer' && esDelMesActual(m));
        const recibidosMes = movs.filter(m => m.tipo === 'transfer_received' && esDelMesActual(m));
        set('kpiEnviado', formatearCOP(enviadosMes.reduce((a, m) => a + Math.abs(m.monto || 0), 0)));
        set('kpiRecibido', formatearCOP(recibidosMes.reduce((a, m) => a + Math.abs(m.monto || 0), 0)));
        set('kpiNumTx', movs.filter(m => m.tipo === 'transfer' || m.tipo === 'transfer_received').length);

        // Historial reciente
        const lista = document.getElementById('historialLista');
        if (!lista) return;
        if (!movs.length) { lista.innerHTML = '<p style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.85rem">Sin movimientos recientes</p>'; return; }

        lista.innerHTML = movs.slice(0, 8).map(m => {

            const tiposIngresoHist = ['deposit', 'loan_disbursement', 'transfer_received'];
            const sent = !tiposIngresoHist.includes(m.tipo);
            const ini = (m.nombreDestino || m.descripcion || 'TX').substring(0, 2).toUpperCase();
            const date = m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '-';
            const monto = formatearCOP(Math.abs(m.monto || 0));
            return `<div class="hist-item">
                <div class="hi-avatar">${ini}</div>
                <div class="hi-info">
                    <div class="hi-name">${m.nombreDestino || m.descripcion || 'Transacción'}</div>
                    <div class="hi-date">${date} · ${m.tipo || 'movimiento'}</div>
                </div>
                <div class="hi-amount ${sent ? 'sent' : 'recv'}">${sent ? '-' : '+'}${monto}</div>
            </div>`;
        }).join('');
    } catch {
        const lista = document.getElementById('historialLista');
        if (lista) lista.innerHTML = '<p style="text-align:center;padding:1rem;color:var(--text-muted);font-size:.83rem">No se pudo cargar el historial</p>';
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="ver-comprobante"]');
    if (!btn) return;
    const d = btn.dataset;
    mostrarComprobantePago({
        referencia: d.referencia,
        fecha: d.fecha || null,
        descripcion: d.descripcion,
        monto: Number(d.monto) || 0,
        tipo: d.tipo,
        estado: d.estado
    });
});

function mostrarComprobantePago(datos) {
    document.getElementById('comprobantePagoModal')?.remove();

    const fecha = datos.fecha
        ? new Date(datos.fecha).toLocaleString('es-CO')
        : new Date().toLocaleString('es-CO');

    const estadoLabel = {
        completed: 'Completado', pending: 'Pendiente',
        failed: 'Fallido', reversed: 'Reversado'
    }[datos.estado] || (datos.estado || 'Completado');

    const modal = document.createElement('div');
    modal.id = 'comprobantePagoModal';
    modal.className = 'modal-overlay active';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem';
    modal.innerHTML = `
        <div style="background:var(--bg-card,#fff);border-radius:14px;max-width:380px;width:100%;padding:1.5rem;box-shadow:0 12px 40px rgba(0,0,0,.25)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                <div style="display:flex;align-items:center;gap:.6rem">
                    <i class="fa-solid fa-circle-check" style="color:#22c55e;font-size:1.4rem"></i>
                    <h3 style="margin:0;color:var(--text-main,#111);font-size:1rem">Comprobante de pago</h3>
                </div>
                <button id="closeComprobantePagoModal" style="background:none;border:none;font-size:1.3rem;line-height:1;cursor:pointer;color:var(--text-muted,#666)">&times;</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem .4rem;font-size:.875rem">
                <span style="color:var(--text-muted,#666)">Referencia</span>
                <span style="font-weight:600">${datos.referencia || '-'}</span>

                <span style="color:var(--text-muted,#666)">Concepto</span>
                <span>${datos.descripcion || '-'}</span>

                <span style="color:var(--text-muted,#666)">Monto</span>
                <span style="font-weight:700;color:#005f73">${formatearCOP(datos.monto || 0)}</span>

                <span style="color:var(--text-muted,#666)">Fecha</span>
                <span>${fecha}</span>

                <span style="color:var(--text-muted,#666)">Estado</span>
                <span class="status-badge status-success" style="width:fit-content">${estadoLabel}</span>
            </div>
            <button type="button" id="closeComprobantePagoModalBtn" style="margin-top:1.2rem;width:100%;padding:.55rem;border:1px solid var(--border-color,#e0e0e0);border-radius:8px;background:transparent;cursor:pointer;font-size:.85rem;color:var(--text-muted,#666)">
                Cerrar
            </button>
        </div>`;

    document.body.appendChild(modal);

    const cerrar = () => modal.remove();
    document.getElementById('closeComprobantePagoModal')?.addEventListener('click', cerrar);
    document.getElementById('closeComprobantePagoModalBtn')?.addEventListener('click', cerrar);
    modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });
}

async function initPaginaPagos() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    /* Cargar cuentas en selector */
    await cargarSelectoresCuenta();
    /* también llenar cuentaPago (nuevo select en pagos.html) */
    const selCuenta = document.getElementById('cuentaPago');
    if (selCuenta && window._cuentasUsuario?.length) {
        selCuenta.innerHTML = '<option value="">Selecciona cuenta</option>' +
            window._cuentasUsuario.map(c =>
                `<option value="${c.numero}">${c.tipo || 'Cuenta'} · ****${(c.numero || '').slice(-4)} (${formatearCOP(c.saldo)})</option>`
            ).join('');
    }

    /* Servicio chips selection */
    document.querySelectorAll('.svc-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.svc-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            const ti = document.getElementById('tipoServicio');
            if (ti) ti.value = chip.dataset.servicio;
        });
    });

    /* Cargar movimientos + préstamos para todos los KPIs */
    let pagos = [];
    try {
        const [resMovs, resPrestamos] = await Promise.all([
            apiFetch('/movimientos?limit=100'),
            apiFetch('/prestamos/mis-prestamos')
        ]);

        if (resMovs?.ok) {
            const movs = await resMovs.json();
            pagos = movs.filter(m => m.tipo === 'fee' || m.tipo === 'loan_payment' || m.tipo === 'payment');
            const totalPagado = pagos.reduce((s, m) => s + Math.abs(m.monto || 0), 0);
            set('kpiPagados', formatearCOP(totalPagado));
            set('kpiNumPagos', pagos.length);
        }
        // Se obtienen desde /prestamos/mis-prestamos que tiene saldoPendiente y cuotaMensual.
        if (resPrestamos?.ok) {
            const prestamos = await resPrestamos.json();
            const activos = prestamos.filter(p => (p.estado || '').toLowerCase() === 'active');
            const totalPendiente = activos.reduce((s, p) => s + (p.saldoPendiente || 0), 0);
            const proxPago = activos.length ? formatearCOP(activos[0].cuotaMensual || 0) : '$ 0';
            set('kpiPendienteTotal', formatearCOP(totalPendiente));
            set('kpiProxPago', proxPago);
            // Pendientes listado
            const listaPend = document.getElementById('listaPagoPendiente');
            if (listaPend) {
                if (!activos.length) {
                    listaPend.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1.5rem">No tienes cuotas pendientes.</p>';
                } else {
                    listaPend.innerHTML = activos.map(p => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:.8rem;border:1px solid var(--border);border-radius:8px;margin-bottom:.6rem;background:var(--bg-card)">
                            <div>
                                <div style="font-weight:600;font-size:.88rem">Cuota préstamo ${p.id || ''}</div>
                                <div style="font-size:.78rem;color:var(--text-muted)">Saldo: ${formatearCOP(p.saldoPendiente || 0)}</div>
                            </div>
                            <div style="text-align:right">
                                <div style="font-weight:700;color:var(--primary)">${formatearCOP(p.cuotaMensual || 0)}</div>
                                <button class="btn-primary" style="font-size:.75rem;padding:.3rem .7rem;margin-top:.3rem"
                                    data-action="pagar-cuota-pendiente" data-id="${p.id || 0}">
                                    <i class="fa-solid fa-money-bill"></i> Pagar
                                </button>
                            </div>
                        </div>`).join('');
                }
            }
        }

        /* Historial */
        const tbody = document.getElementById('historialPagosBody') || document.getElementById('listaPagosRecientes');
        if (tbody) {
            if (!pagos.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-20" style="color:var(--text-muted)">Sin pagos registrados</td></tr>'; }
            else {
                tbody.innerHTML = pagos.slice(0, 15).map((m, idx) => {
                    const refSeg = (m.referencia || ('PAY-' + idx)).replace(/'/g, "");
                    return `<tr>
                    <td>${m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : '-'}</td>
                    <td>${m.descripcion || ({ fee: 'Servicio', loan_payment: 'Cuota préstamo', payment: 'Pago' }[m.tipo]) || m.tipo}</td>
                    <td style="font-family:var(--font-mono,monospace);font-size:.8rem">${m.referencia || '-'}</td>
                    <td>${formatearCOP(m.monto)}</td>
                    <td><span class="status-pill st-success">Completado</span></td>
                    <td style="text-align:right">
                        <button data-action="ver-comprobante"
                            data-referencia="${m.referencia || refSeg}"
                            data-fecha="${m.fecha || ''}"
                            data-descripcion="${m.descripcion || (({ fee: "Servicio", loan_payment: "Cuota préstamo", payment: "Pago" })[m.tipo]) || m.tipo}"
                            data-monto="${m.monto || 0}"
                            data-estado="${m.estado || 'completed'}"
                            class="btn-secondary" style="font-size:.75rem;padding:.3rem .6rem">
                            <i class="fa-solid fa-receipt"></i>
                        </button>
                    </td>
                </tr>`;
                }).join('');
            }
        }
    } catch { /* silencioso */ }

    /* Préstamos pendientes */
    try {
        const res = await apiFetch('/prestamos/mis-prestamos');
        if (res?.ok) {
            const pres = await res.json();
            const activos = pres.filter(p => p.estado === 'active' || p.estado === 'ACTIVE');
            const totalDeuda = activos.reduce((s, p) => s + (p.cuotaMensual || 0), 0);
            set('kpiPendienteTotal', formatearCOP(totalDeuda));
            if (activos.length) {
                const proxFecha = activos[0].proximoPago || activos[0].fechaProximaCuota;
                set('kpiProxPago', proxFecha ? new Date(proxFecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : activos.length + ' crédito(s)');
            }

            const listaPend = document.getElementById('listaPagoPendiente');
            if (listaPend) {
                if (!activos.length) {
                    listaPend.innerHTML = '<p style="text-align:center;padding:1.2rem;color:var(--text-muted);font-size:.84rem">✅ Sin pagos pendientes</p>';
                } else {
                    listaPend.innerHTML = activos.map(p => {
                        const fecha = p.proximoPago ? new Date(p.proximoPago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Por definir';
                        return `<div class="pend-item">
                            <div class="pi-info">
                                <div class="pi-name">Cuota Préstamo #${p.id}</div>
                                <div class="pi-date">Vence: ${fecha}</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:.7rem">
                                <span class="pi-monto">${formatearCOP(p.cuotaMensual || 0)}</span>
                                <button class="btn-primary btn-pagar-cuota"
                                    data-id="${p.id}"
                                    data-monto="${p.cuotaMensual || 0}"
                                    data-fecha="${fecha}"
                                    style="font-size:.77rem;padding:.35rem .75rem">
                                    <i class="fa-solid fa-money-bill"></i> Pagar
                                </button>
                            </div>
                        </div>`;
                    }).join('');

                    // Listeners modal pago
                    document.querySelectorAll('.btn-pagar-cuota').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const id = btn.dataset.id;
                            const monto = parseFloat(btn.dataset.monto) || 0;
                            const fecha = btn.dataset.fecha;
                            abrirModalPagarCuota(id, monto, fecha);
                        });
                    });
                }
            }
        }
    } catch { /* silencioso */ }

    /* Formulario pagar servicio */
    document.getElementById('formPagoServicio')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipo = document.getElementById('tipoServicio')?.value;
        const ref = document.getElementById('refPago')?.value?.trim();
        const monto = parseInt((document.getElementById('montoPago')?.value || '').replace(/\D/g, ''));
        const cuenta = document.getElementById('cuentaPago')?.value;
        if (!tipo) return mostrarToast('Selecciona el tipo de servicio', 'warning');
        if (!ref) return mostrarToast('Ingresa el número de referencia', 'warning');
        if (!monto) return mostrarToast('Ingresa un monto válido', 'warning');
        if (!cuenta) return mostrarToast('Selecciona una cuenta de origen', 'warning');
        const btn = document.getElementById('btnConfirmarPago');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
        try {
            const res = await apiFetch('/pagos', {
                method: 'POST',
                body: JSON.stringify({ tipoServicio: tipo, referencia: ref, monto, numeroCuenta: cuenta })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarToast('✅ Pago realizado correctamente', 'success');
                setTimeout(() => location.reload(), 1800);
            } else mostrarToast(data.mensaje || 'Error al procesar el pago', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Confirmar Pago'; }
    });

    // Inicializar modal pagar cuota (pagos.html)
    inicializarModalPagarCuota();
}

/* Botón "Pagar" de la lista de cuotas pendientes (pagos.html) */
function pagarCuotaPendiente(id) {
    apiFetch(`/prestamos/${id}/pagar`, { method: 'POST' })
        .then(() => { mostrarToast('Pago procesado ✅', 'success'); location.reload(); })
        .catch(() => mostrarToast('Error al procesar pago', 'error'));
}
document.getElementById('listaPagoPendiente')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="pagar-cuota-pendiente"]');
    if (btn) pagarCuotaPendiente(Number(btn.dataset.id));
});

function inicializarModalPagarCuota() {
    const modal = document.getElementById('modalPagarCuota');
    if (!modal) return;

    const cerrar = () => { modal.classList.add('hidden'); modal.classList.remove('active'); };

    document.getElementById('closeModalPagarCuota')?.addEventListener('click', cerrar);
    document.getElementById('btnCancelarPagoModal')?.addEventListener('click', cerrar);
    modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });

    // Cargar cuentas en el select del modal
    apiFetch('/cuentas').then(async r => {
        if (!r?.ok) return;
        const cuentas = await r.json();
        const sel = document.getElementById('mpcCuenta');
        if (!sel) return;
        sel.innerHTML = '<option value="">Selecciona cuenta...</option>';
        cuentas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.numero || c.id;
            opt.textContent = `${c.tipo || 'Cuenta'} ****${(c.numero || '').slice(-4)} (${formatearCOP(c.saldo)})`;
            sel.appendChild(opt);
        });
    }).catch(() => { });

    document.getElementById('btnConfirmarPagoModal')?.addEventListener('click', async () => {
        const loanId = modal.dataset.loanId;
        const monto = parseFloat(modal.dataset.monto) || 0;
        const cuenta = document.getElementById('mpcCuenta')?.value;
        if (!cuenta) return mostrarToast('Selecciona una cuenta de débito', 'warning');

        const btn = document.getElementById('btnConfirmarPagoModal');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
        try {
            const res = await apiFetch(`/prestamos/${loanId}/pagar`, {
                method: 'POST',
                body: JSON.stringify({ monto, numeroCuenta: cuenta })
            });
            const data = await res.json();
            if (res?.ok) {
                cerrar();
                mostrarToast('✅ Pago procesado exitosamente', 'success');
                setTimeout(() => location.reload(), 1600);
            } else {
                mostrarToast(data.mensaje || 'Error al procesar el pago', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Pagar Ahora';
        }
    });
}

/** Abre el modal de pago de cuota con los datos del préstamo */
function abrirModalPagarCuota(loanId, monto, fecha) {
    const modal = document.getElementById('modalPagarCuota');
    if (!modal) return;
    modal.dataset.loanId = loanId;
    modal.dataset.monto = monto;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('mpcConcepto', `Cuota Préstamo #${loanId}`);
    set('mpcFecha', fecha || 'Por definir');
    set('mpcMonto', formatearCOP(monto));
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function cargarSelectoresCuenta() {
    const selectores = ['originAccount', 'cuenta', 'metodoPago']
        .map(id => document.getElementById(id)).filter(Boolean);
    if (!selectores.length) return;

    try {
        const res = await apiFetch('/cuentas');
        if (!res?.ok) throw new Error();
        const cuentas = await res.json();
        window._cuentasUsuario = cuentas;

        selectores.forEach(sel => {
            sel.innerHTML = '';
            if (!cuentas.length) {
                sel.innerHTML = '<option disabled selected>Sin cuentas disponibles</option>';
                return;
            }
            const def = document.createElement('option');
            def.value = ''; def.disabled = true; def.selected = true;
            def.textContent = 'Selecciona una cuenta';
            sel.appendChild(def);
            cuentas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.numero;
                opt.dataset.id = c.id;
                opt.textContent = `${c.tipo || 'Cuenta'} · ****${(c.numero || '').slice(-4)} (${formatearCOP(c.saldo)})`;
                sel.appendChild(opt);
            });
        });
    } catch {
        selectores.forEach(s =>
            s.innerHTML = '<option disabled selected>Error cargando cuentas</option>');
    }
}


/* =============================================================================
   NOTIFICACIONES PUSH — WebSocket STOMP en tiempo real
   ============================================================================= */
async function initNotificacionesPush() {
    /* Solo conectar si las librerías están disponibles */
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        /* Intentar polling ligero cada 30 seg como fallback */
        setInterval(async () => {
            try {
                const res = await apiFetch('/notificaciones/no-leidas');
                if (!res?.ok) return;
                const data = await res.json();
                const badge = document.querySelector('.notif-badge, #notifCount');
                if (badge && data.total > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = data.total;
                }
            } catch { /* silencioso */ }
        }, 30000);
        return;
    }

    try {
        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);
        client.debug = () => { };
        client.connect({ Authorization: `Bearer ${getToken()}` }, () => {
            client.subscribe('/user/queue/notificaciones', (msg) => {
                const notif = JSON.parse(msg.body);
                mostrarToast(`🔔 ${notif.titulo}: ${notif.mensaje}`, 'info');
                /* Actualizar badge */
                const badge = document.querySelector('.notif-badge, #notifCount');
                if (badge) {
                    badge.style.display = 'flex';
                    badge.textContent = parseInt(badge.textContent || '0') + 1;
                }

            });
        }, (err) => { console.warn('WebSocket no disponible:', err); });
    } catch (e) { console.warn('WebSocket error:', e); }
}


/* =============================================================================
   BOTONES SUELTOS — listeners por página
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* ══════════════════════════════════════════════════════════════════
       CUENTAS — copiar número
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnCopiarCuenta')?.addEventListener('click', () => {
        const numEl = document.getElementById('numeroCuentaDisplay') ||
            document.querySelector('.account-number');
        const texto = numEl?.textContent?.trim();
        if (!texto) return mostrarToast('No hay número de cuenta', 'warning');
        navigator.clipboard.writeText(texto)
            .then(() => mostrarToast('Número copiado ✓', 'success'))
            .catch(() => mostrarToast('No se pudo copiar', 'error'));
    });

    /* Recibir — mostrar QR de la cuenta */
    document.getElementById('btnRecibir')?.addEventListener('click', () => {
        const qrSection = document.querySelector('.qr-card') ||
            document.getElementById('qrcode')?.closest('div') ||
            document.querySelector('.qr-box')?.closest('section');
        if (qrSection) qrSection.scrollIntoView({ behavior: 'smooth' });
        mostrarToast('Comparte tu QR para recibir pagos', 'info');
    });

    /* ══════════════════════════════════════════════════════════════════
       COMUNIDAD — cancelar post
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnCancelPost')?.addEventListener('click', () => {
        const form = document.getElementById('formNuevoPost') ||
            document.querySelector('form.post-form');
        if (form) form.reset();
        mostrarToast('Publicación cancelada', 'info');
    });

    /* ══════════════════════════════════════════════════════════════════
       SALUD FINANCIERA — actualizar
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnActualizar')?.addEventListener('click', async () => {
        const btn = document.getElementById('btnActualizar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Actualizando...';

        const mes = document.getElementById('filtroMes')?.value;
        const anio = document.getElementById('filtroAnio')?.value;

        try {
            const url = (mes && anio)
                ? `/salud-financiera?mes=${mes}&anio=${anio}`
                : '/salud-financiera';
            const res = await apiFetch(url);
            const data = await res.json();

            const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            const setW = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };

            const ingresos = parseFloat(data.ingresos || 0);
            const egresos = parseFloat(data.egresos || 0);
            const saldo = ingresos - egresos;
            const puntaje = parseInt(data.puntaje || 0);
            const efPct = ingresos > 0 ? Math.round((saldo / ingresos) * 100) : 0;

            set('valIngresos', formatearCOP(ingresos));
            set('valEgresos', formatearCOP(egresos));
            set('valSaldo', formatearCOP(saldo));
            set('scoreFinanciero', puntaje);
            set('labelScore', data.nivel || '—');
            set('lblEficiencia', efPct + '% Eficiencia');
            set('pctIngresos', '+' + efPct + '% vs mes ant.');
            set('pctEgresos', Math.round(ingresos > 0 ? (egresos / ingresos) * 100 : 0) + '% del ingreso');

            setW('barScore', Math.min(puntaje, 100));
            setW('barEficiencia', Math.min(efPct, 100));

            mostrarToast('Datos actualizados ✅', 'success');
        } catch { mostrarToast('Usando datos en caché', 'info'); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Actualizar';
        }
    });

    /* ══════════════════════════════════════════════════════════════════
       ROLES / PERMISOS — guardar permisos y confirmar rol
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnSavePermissions')?.addEventListener('click', async () => {
        const permisos = {};
        document.querySelectorAll('[data-permiso]').forEach(cb => {
            permisos[cb.dataset.permiso] = cb.checked;
        });
        try {
            const res = await apiFetch('/admin/roles/permisos', {
                method: 'PUT', body: JSON.stringify({ permisos })
            });
            mostrarToast(res.ok ? 'Permisos guardados ✅' : 'Error al guardar', res.ok ? 'success' : 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
    });

    document.getElementById('btnConfirmarRol')?.addEventListener('click', async () => {
        const nombre = document.getElementById('inputNombreRol')?.value?.trim();
        const desc = document.getElementById('inputDescRol')?.value?.trim();
        if (!nombre) return mostrarToast('El nombre del rol es obligatorio', 'warning');
        try {
            const res = await apiFetch('/admin/roles', {
                method: 'POST', body: JSON.stringify({ nombre, descripcion: desc })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarToast('Rol creado ✅', 'success');
                const modal = document.getElementById('modalRol');
                if (modal) { modal.classList.add('hidden'); modal.classList.remove('active'); modal.style.display = 'none'; }
            } else {
                mostrarToast(data.mensaje || 'Error al crear rol', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
    });

    /* ══════════════════════════════════════════════════════════════════
       DETALLE PRÉSTAMO — imprimir amortización
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnPrintAmortizacion')?.addEventListener('click', () => {
        window.print();
    });

    /* ══════════════════════════════════════════════════════════════════
       DOCUMENTOS — subir archivo
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnSubir')?.addEventListener('click', () => {
        const input = document.getElementById('fileInput') ||
            document.querySelector('input[type="file"]');
        if (input) input.click();
    });

    /* ══════════════════════════════════════════════════════════════════
       SOPORTE — enviar ticket
       ══════════════════════════════════════════════════════════════════ */

    document.getElementById('btnEnviarTicket')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const form = e.target.closest('form') || document.getElementById('ticketForm');
        const asunto = document.getElementById('asunto')?.value?.trim();
        const desc = document.getElementById('descripcion')?.value?.trim();
        const tipo = document.getElementById('tipoTicket')?.value;

        if (!asunto || !desc) return mostrarToast('Completa todos los campos', 'warning');

        const btn = document.getElementById('btnEnviarTicket');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

        try {
            const res = await apiFetch('/soporte/tickets', {
                method: 'POST',
                body: JSON.stringify({ asunto, descripcion: desc, tipo: tipo || 'general' })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarToast(`Ticket #${data.id || '---'} creado ✅`, 'success');
                if (form) form.reset();
            } else {
                mostrarToast(data.mensaje || 'Error al crear ticket', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Solicitud';
        }
    });

}); /* fin DOMContentLoaded — BOTONES SUELTOS */


/* =============================================================================
   HISTORIAL-ANALISIS — filtros, KPIs, exportar CSV
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('historial-analisis')) return;

    cargarHistorialAnalisis();

    document.getElementById('btnFiltrarReporte')?.addEventListener('click', cargarHistorialAnalisis);

    /* Búsqueda en tabla */
    document.getElementById('busquedaTabla')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#historialBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
});

async function cargarHistorialAnalisis() {
    /* Soporte tanto para filterPeriod (historial-analisis) como para fechaInicio/fechaFin (historial) */
    const periodo = document.getElementById('filterPeriod')?.value;
    const tipo = document.getElementById('filterType')?.value;
    let f1 = document.getElementById('fechaInicio')?.value;
    let f2 = document.getElementById('fechaFin')?.value;

    /* Si hay selector de período, calcular rango de fechas */
    if (periodo && !f1) {
        const hoy = new Date();
        const hasta = hoy.toISOString().split('T')[0];
        let desde;
        if (periodo === '2026') {
            desde = '2026-01-01';
        } else {
            const d = new Date(hoy);
            d.setDate(d.getDate() - parseInt(periodo));
            desde = d.toISOString().split('T')[0];
        }
        f1 = desde;
        f2 = hasta;
    }

    let url = '/movimientos';
    const params = [];
    if (f1) params.push(`inicio=${f1}T00:00:00`);
    if (f2) params.push(`fin=${f2}T23:59:59`);
    if (tipo && tipo !== 'todos') params.push(`tipo=${tipo}`);
    if (params.length) url += '?' + params.join('&');

    const tbody = document.getElementById('historialBody');
    if (tbody) mostrarCargandoTabla(tbody, 5);

    try {
        const res = await apiFetch(url);
        if (!res?.ok) throw new Error();
        const movs = await res.json();

        /* KPIs */
        const ingresos = movs.filter(m => ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo))
            .reduce((s, m) => s + parseFloat(m.monto || 0), 0);
        const egresos = movs.filter(m => !['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo))
            .reduce((s, m) => s + parseFloat(m.monto || 0), 0);

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('totalIngresos', formatearCOP(ingresos));
        set('totalEgresos', formatearCOP(egresos));
        set('balanceNeto', formatearCOP(ingresos - egresos));
        /* historial.html KPIs */
        set('kpiTotalMovs', movs.length);
        set('kpiTotalIngresos', formatearCOP(ingresos));
        set('kpiTotalEgresos', formatearCOP(egresos));
        set('kpiNetoPeriodo', formatearCOP(ingresos - egresos));

        /* Barra de meta */
        const meta = 2000000;
        const pct = Math.min(100, Math.round((ingresos / meta) * 100));
        const fill = document.getElementById('metaProgressFill');
        const txt = document.getElementById('metaProgressText');
        if (fill) fill.style.width = pct + '%';
        if (txt) txt.textContent = pct + '%';

        /* Tabla */
        if (tbody) {
            if (!movs.length) { mostrarVacioTabla(tbody, 'Sin movimientos en el período', 5); return; }
            const tipos = {
                deposit: 'Depósito', withdrawal: 'Retiro', transfer: 'Transferencia',
                transfer_sent: 'Transf. enviada', transfer_received: 'Transf. recibida',
                loan_disbursement: 'Desembolso', loan_payment: 'Pago Préstamo', fee: 'Servicio'
            };
            tbody.innerHTML = movs.map(m => {
                const esIng = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
                const rowCls = esIng ? 'tx-ingreso' : 'tx-egreso';
                return `<tr class="${rowCls}">
                    <td>${m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : '-'}</td>
                    <td>${tipos[m.tipo] || m.tipo}</td>
                    <td>${m.descripcion || '-'}</td>
                    <td style="font-family:var(--font-mono,monospace);font-size:.78rem">${m.referencia || '#' + m.id}</td>
                    <td style="text-align:right">${esIng ? '+' : '-'}${formatearCOP(m.monto)}</td>
                    <td style="text-align:right">
                        <button data-action="ver-comprobante"
                            data-referencia="${m.referencia || ('#' + m.id)}"
                            data-fecha="${m.fecha || ''}"
                            data-descripcion="${m.descripcion || (tipos[m.tipo] || m.tipo)}"
                            data-monto="${m.monto || 0}"
                            data-tipo="${tipos[m.tipo] || m.tipo}"
                            data-estado="${m.estado || 'completed'}"
                            class="btn-secondary" style="font-size:.73rem;padding:.28rem .55rem" title="Ver comprobante">
                            <i class="fa-solid fa-receipt"></i> Ver
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }
    } catch {
        if (tbody) mostrarErrorTabla(tbody, 'Error al cargar movimientos', 5);
    }
}


/* =============================================================================
   COMUNIDAD — feed, miembros, calendario, modal post
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('comunidad')) return;

    const tabActivo = document.querySelector('.tab-btn.active');
    if (tabActivo) {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById('tab-' + tabActivo.dataset.tab);
        if (pane) pane.classList.add('active');
    } else {
        /* Fallback: activar publicaciones por defecto */
        const defaultBtn = document.querySelector('.tab-btn[data-tab="publicaciones"]');
        const defaultPane = document.getElementById('tab-publicaciones');
        if (defaultBtn) defaultBtn.classList.add('active');
        if (defaultPane) defaultPane.classList.add('active');
    }

    cargarFeedComunidad();
    cargarMiembrosComunidad();
    cargarCalendarioComunidad();

    /* Modal nuevo post */
    const modalPost = document.getElementById('modalPost');
    document.getElementById('triggerModal')?.addEventListener('click', () => {
        if (modalPost) { modalPost.classList.remove('hidden'); modalPost.style.display = 'flex'; }
    });
    document.getElementById('closeModalPost')?.addEventListener('click', () => {
        if (modalPost) { modalPost.classList.add('hidden'); modalPost.style.display = 'none'; }
    });
    modalPost?.addEventListener('click', e => {
        if (e.target === modalPost) { modalPost.classList.add('hidden'); modalPost.style.display = 'none'; }
    });

    /* Preview de imagen en post */
    document.getElementById('inputFile')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = document.getElementById('imagePreview');
        const container = document.getElementById('previewContainer');
        if (preview && container) {
            preview.src = URL.createObjectURL(file);
            container.classList.remove('hidden');
        }
    });

    /* Enviar post */
    document.getElementById('formPost')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mensaje = document.getElementById('mensajePost')?.value?.trim();
        if (!mensaje) return mostrarToast('Escribe algo para publicar', 'warning');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const res = await apiFetch('/comunidad/publicaciones', {
                method: 'POST', body: JSON.stringify({ contenido: mensaje })
            });
            if (res?.ok) {
                mostrarToast('Publicación enviada ✅', 'success');
                if (modalPost) { modalPost.classList.add('hidden'); modalPost.style.display = 'none'; }
                e.target.reset();
                document.getElementById('previewContainer')?.classList.add('hidden');
                await cargarFeedComunidad();
            } else mostrarToast('Error al publicar', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; }
    });
});

async function cargarFeedComunidad() {
    const feed = document.getElementById('feedPublicaciones');
    if (!feed) return;
    feed.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</p>';
    try {
        const res = await apiFetch('/comunidad/publicaciones');
        const pubs = res?.ok ? await res.json() : [];
        if (!pubs.length) {
            feed.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Sé el primero en publicar algo 🌱</p>';
            return;
        }
        feed.innerHTML = pubs.map(p => {
            const esEvento = p.tipo === 'evento';
            return `
            <div class="post-card" data-post-id="${p.id}" style="background:var(--bg-card);border-radius:12px;padding:1rem;margin-bottom:.8rem;box-shadow:var(--shadow)">
                <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.5rem">
                    <div class="avatar-circle" style="width:36px;height:36px;font-size:.8rem">
                        ${(p.autor?.charAt(0) || '?').toUpperCase()}</div>
                    <div style="flex:1"><strong style="font-size:.9rem">${p.autor || 'Usuario'}</strong>
                        <div style="font-size:.75rem;color:var(--text-muted)">
                            ${p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </div>
                    ${esEvento ? '<span style="background:#e0f2fe;color:var(--primary);font-size:.7rem;font-weight:700;padding:.2rem .55rem;border-radius:20px"><i class="fa-regular fa-calendar-check"></i> Evento</span>' : ''}
                </div>
                <p style="font-size:.88rem;color:var(--text-main);white-space:pre-wrap">${p.contenido || ''}</p>
                ${esEvento && p.eventoFecha ? `<div style="font-size:.78rem;color:var(--primary);margin-top:.3rem"><i class="fa-regular fa-clock"></i> ${new Date(p.eventoFecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>` : ''}
                ${p.imagenUrl ? `<img src="${p.imagenUrl}" style="max-width:100%;border-radius:8px;margin-top:.5rem">` : ''}
                <div style="margin-top:.7rem;padding-top:.6rem;border-top:1px solid var(--border-color)">
                    <button data-action="like-post" data-id="${p.id}" class="btn-like" data-liked="${!!p.likedByMe}"
                        style="background:none;border:none;cursor:pointer;font-size:.82rem;color:${p.likedByMe ? '#e11d48' : 'var(--text-muted)'};display:inline-flex;align-items:center;gap:.35rem">
                        <i class="fa-${p.likedByMe ? 'solid' : 'regular'} fa-heart"></i>
                        <span class="like-count">${p.likes ?? 0}</span> Me gusta
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch {
        feed.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Error al cargar publicaciones</p>';
    }
}

/* Alterna "Me gusta" en una publicación */
document.getElementById('feedPublicaciones')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="like-post"]');
    if (btn) alternarLikePublicacion(Number(btn.dataset.id), btn);
});

async function alternarLikePublicacion(postId, btn) {
    const wasLiked = btn.dataset.liked === 'true';
    const countEl = btn.querySelector('.like-count');
    const icon = btn.querySelector('i');
    /* Optimista */
    btn.dataset.liked = (!wasLiked).toString();
    countEl.textContent = parseInt(countEl.textContent || '0') + (wasLiked ? -1 : 1);
    icon.className = `fa-${wasLiked ? 'regular' : 'solid'} fa-heart`;
    btn.style.color = wasLiked ? 'var(--text-muted)' : '#e11d48';
    try {
        const res = await apiFetch(`/comunidad/publicaciones/${postId}/like`, { method: 'POST' });
        if (!res?.ok) throw new Error();
        const data = await res.json();
        countEl.textContent = data.likes;
        btn.dataset.liked = data.liked.toString();
        icon.className = `fa-${data.liked ? 'solid' : 'regular'} fa-heart`;
        btn.style.color = data.liked ? '#e11d48' : 'var(--text-muted)';
    } catch {
        /* Revertir si falla */
        btn.dataset.liked = wasLiked.toString();
        countEl.textContent = parseInt(countEl.textContent || '0') + (wasLiked ? 1 : -1);
        icon.className = `fa-${wasLiked ? 'solid' : 'regular'} fa-heart`;
        btn.style.color = wasLiked ? '#e11d48' : 'var(--text-muted)';
        mostrarToast('No se pudo registrar el "Me gusta"', 'error');
    }
}

async function cargarMiembrosComunidad() {
    const lista = document.getElementById('listaMiembros');
    if (!lista) return;
    const miId = getSession()?.id;
    try {
        const res = await apiFetch('/comunidad/miembros');
        const mbs = res?.ok ? await res.json() : [];
        if (!mbs.length) { lista.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Sin miembros</p>'; return; }
        lista.innerHTML = mbs.map(m => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border-color)">
                <div class="avatar-circle" style="width:32px;height:32px;font-size:.75rem;flex-shrink:0">
                    ${(m.iniciales || m.nombre?.charAt(0) || '?').toUpperCase()}</div>
                <div style="flex:1"><div style="font-size:.85rem;font-weight:600">${m.nombre || 'Usuario'}${m.id == miId ? ' <span style=\'color:var(--text-muted);font-weight:400\'>(tú)</span>' : ''}</div>
                    <div style="font-size:.75rem;color:var(--text-muted)">${m.rol || 'Socio'}</div></div>
                ${m.id != miId ? `<button data-action="chat-privado" data-id="${m.id}" data-nombre="${m.nombre || 'Usuario'}" class="btn-secondary" style="font-size:.73rem;padding:.32rem .6rem;flex-shrink:0">
                    <i class="fa-regular fa-comment-dots"></i> Mensaje</button>` : ''}
            </div>`).join('');
    } catch { lista.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Error al cargar</p>'; }
}

document.getElementById('listaMiembros')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="chat-privado"]');
    if (btn) abrirChatPrivado(Number(btn.dataset.id), btn.dataset.nombre);
});

/* ─── Chat privado y chat de grupo (comparten el mismo modal) ─────────────── */
let _chatDestino = null; // { tipo: 'user' | 'grupo', id }
let _chatPollInterval = null;

function construirModalChat() {
    if (document.getElementById('modalChatPrivado')) return;
    const div = document.createElement('div');
    div.id = 'modalChatPrivado';
    div.className = 'modal-overlay';
    div.style.display = 'none';
    div.innerHTML = `
        <div class="modal-content" style="max-width:420px;display:flex;flex-direction:column;height:560px">
            <div class="modal-header">
                <h3 id="chatPrivadoTitulo"><i class="fa-regular fa-comment-dots"></i> Chat</h3>
                <button id="closeChatPrivado" class="modal-close">&times;</button>
            </div>
            <div id="chatPrivadoMensajes" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.5rem;background:var(--bg-light,#f8fafc)"></div>
            <form id="formChatPrivado" style="display:flex;gap:.5rem;padding:.8rem;border-top:1px solid var(--border-color)">
                <input type="text" id="chatPrivadoInput" placeholder="Escribe un mensaje..." autocomplete="off"
                    style="flex:1;padding:.6rem .8rem;border:1px solid var(--border-color);border-radius:20px;font-size:.85rem">
                <button type="submit" class="btn-primary" style="border-radius:50%;width:38px;height:38px;padding:0">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>`;
    document.body.appendChild(div);

    document.getElementById('closeChatPrivado').addEventListener('click', cerrarChatPrivado);
    div.addEventListener('click', e => { if (e.target === div) cerrarChatPrivado(); });
    document.getElementById('formChatPrivado').addEventListener('submit', async e => {
        e.preventDefault();
        const input = document.getElementById('chatPrivadoInput');
        const texto = input.value.trim();
        if (!texto || !_chatDestino) return;
        input.value = '';
        try {
            const body = _chatDestino.tipo === 'grupo'
                ? { groupId: _chatDestino.id, mensaje: texto }
                : { receiverId: _chatDestino.id, mensaje: texto };
            const res = await apiFetch('/chat/enviar', { method: 'POST', body: JSON.stringify(body) });
            if (!res?.ok) throw new Error();
            await renderMensajesChat();
        } catch { mostrarToast('No se pudo enviar el mensaje', 'error'); }
    });
}

async function renderMensajesChat() {
    const cont = document.getElementById('chatPrivadoMensajes');
    if (!cont || !_chatDestino) return;
    const miId = getSession()?.id;
    try {
        const url = _chatDestino.tipo === 'grupo'
            ? `/chat/grupo/${_chatDestino.id}`
            : `/chat/conversacion/${_chatDestino.id}`;
        const res = await apiFetch(url);
        const msgs = res?.ok ? await res.json() : [];
        cont.innerHTML = msgs.length ? msgs.map(m => {
            const esMio = (m.senderId ?? m.remitenteId ?? m.senderID) == miId;
            const hora = m.fecha || m.createdAt ? new Date(m.fecha || m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
            const autor = (_chatDestino.tipo === 'grupo' && !esMio && (m.senderNombre || m.remitenteNombre))
                ? `<div style="font-size:.68rem;font-weight:700;color:var(--primary);margin-bottom:.15rem">${m.senderNombre || m.remitenteNombre}</div>` : '';
            return `<div style="align-self:${esMio ? 'flex-end' : 'flex-start'};max-width:75%">
                <div style="background:${esMio ? 'var(--primary)' : '#fff'};color:${esMio ? '#fff' : 'var(--text-main)'};
                    padding:.5rem .8rem;border-radius:14px;${esMio ? 'border-bottom-right-radius:4px' : 'border-bottom-left-radius:4px'};
                    font-size:.85rem;box-shadow:var(--shadow);word-break:break-word">${autor}${m.contenido || m.mensaje || ''}</div>
                <div style="font-size:.68rem;color:var(--text-muted);margin-top:.15rem;text-align:${esMio ? 'right' : 'left'}">${hora}</div>
            </div>`;
        }).join('') : '<p style="text-align:center;color:var(--text-muted);font-size:.82rem;margin:auto">Aún no hay mensajes. ¡Saluda! 👋</p>';
        cont.scrollTop = cont.scrollHeight;
    } catch { cont.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:.82rem">Error al cargar la conversación</p>'; }
}

function abrirChatPrivado(otroUserId, nombre) {
    construirModalChat();
    _chatDestino = { tipo: 'user', id: otroUserId };
    document.getElementById('chatPrivadoTitulo').innerHTML = `<i class="fa-regular fa-comment-dots"></i> ${nombre}`;
    document.getElementById('modalChatPrivado').style.display = 'flex';
    renderMensajesChat();
    if (_chatPollInterval) clearInterval(_chatPollInterval);
    _chatPollInterval = setInterval(renderMensajesChat, 6000);
}

function abrirChatGrupo(groupId, nombre) {
    construirModalChat();
    _chatDestino = { tipo: 'grupo', id: groupId };
    document.getElementById('chatPrivadoTitulo').innerHTML = `<i class="fa-solid fa-people-group"></i> ${nombre}`;
    document.getElementById('modalChatPrivado').style.display = 'flex';
    renderMensajesChat();
    if (_chatPollInterval) clearInterval(_chatPollInterval);
    _chatPollInterval = setInterval(renderMensajesChat, 6000);
}

function cerrarChatPrivado() {
    const modal = document.getElementById('modalChatPrivado');
    if (modal) modal.style.display = 'none';
    if (_chatPollInterval) { clearInterval(_chatPollInterval); _chatPollInterval = null; }
    _chatDestino = null;
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="chat-grupo"]');
    if (!btn) return;
    abrirChatGrupo(btn.dataset.grupoId, btn.dataset.grupoNombre);
});


document.getElementById('calendarGrid')?.addEventListener('click', (e) => {
    const span = e.target.closest('[data-action="set-fecha-evento"]');
    if (!span) return;
    const input = document.getElementById('eventoFecha') || document.getElementById('fechaEvento');
    if (input) input.value = span.dataset.fecha;
});

async function cargarCalendarioComunidad() {
    const grid = document.getElementById('calendarGrid');
    const eventos = document.getElementById('eventosProximos');
    const label = document.getElementById('calMesLabel');
    if (!grid && !eventos) return;

    if (!window._calMesActual) window._calMesActual = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    try {
        const res = await apiFetch('/comunidad/eventos');
        const evs = res?.ok ? await res.json() : [];
        window._calEventos = evs;
    } catch { window._calEventos = window._calEventos || []; }

    const evs = window._calEventos || [];

    /* Próximos eventos (desde hoy) */
    if (eventos) {
        const hoyStr = new Date().toISOString().split('T')[0];
        const proximos = evs.filter(ev => ev.fecha >= hoyStr).sort((a, b) => a.fecha.localeCompare(b.fecha));
        eventos.innerHTML = proximos.length
            ? proximos.map(ev => `
                <div style="padding:.5rem 0;border-bottom:1px solid var(--border-color)">
                    <strong style="font-size:.85rem">${ev.titulo || 'Evento'}</strong>
                    <div style="font-size:.75rem;color:var(--text-muted)">
                        ${ev.fecha ? new Date(ev.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                        ${ev.hora ? ' · ' + ev.hora.slice(0, 5) : ''}${ev.lugar ? ' · ' + ev.lugar : ''}</div>
                </div>`).join('')
            : '<p style="color:var(--text-muted);font-size:.85rem">Sin eventos próximos</p>';
    }

    if (!grid) return;

    /* Render del calendario completo del mes actual */
    const fechaRef = window._calMesActual;
    const anio = fechaRef.getFullYear();
    const mes = fechaRef.getMonth(); // 0-11

    if (label) label.textContent = fechaRef.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        .replace(/^./, c => c.toUpperCase());

    const eventosPorDia = {};
    evs.forEach(ev => {
        if (!ev.fecha) return;
        (eventosPorDia[ev.fecha] ||= []).push(ev);
    });

    const primerDia = new Date(anio, mes, 1);
    /* getDay(): 0=domingo..6=sábado → convertir a lunes=0..domingo=6 */
    const offset = (primerDia.getDay() + 6) % 7;
    const totalDias = new Date(anio, mes + 1, 0).getDate();
    const hoyStr = new Date().toISOString().split('T')[0];

    let celdas = '';
    for (let i = 0; i < offset; i++) celdas += '<span class="calendar-day empty"></span>';
    for (let d = 1; d <= totalDias; d++) {
        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const tieneEvento = !!eventosPorDia[fechaStr];
        const esHoy = fechaStr === hoyStr;
        const titulosDia = tieneEvento ? eventosPorDia[fechaStr].map(e => e.titulo).join(', ') : '';
        celdas += `<span class="calendar-day${tieneEvento ? ' has-event' : ''}${esHoy ? ' today' : ''}"
            ${titulosDia ? `title="${titulosDia.replace(/"/g, '&quot;')}"` : ''}
            data-action="set-fecha-evento" data-fecha="${fechaStr}">${d}</span>`;
    }
    grid.innerHTML = celdas;
}

document.getElementById('backupHistory')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="restaurar-backup"]')) {
        mostrarToast('Iniciando restauración...', 'info');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('comunidad.html')) return;
    document.getElementById('calPrevMes')?.addEventListener('click', () => {
        const f = window._calMesActual || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        window._calMesActual = new Date(f.getFullYear(), f.getMonth() - 1, 1);
        cargarCalendarioComunidad();
    });
    document.getElementById('calNextMes')?.addEventListener('click', () => {
        const f = window._calMesActual || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        window._calMesActual = new Date(f.getFullYear(), f.getMonth() + 1, 1);
        cargarCalendarioComunidad();
    });

    document.getElementById('btnPublicarEvento')?.addEventListener('click', () => {
        const modal = document.getElementById('modalEvento');
        if (!modal) return;
        modal.style.display = 'flex';
        const fechaInput = document.getElementById('eventoFecha');
        if (fechaInput && !fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    });
});


/* =============================================================================
   AUDITORIA — init, filtros, búsqueda
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('auditoria')) return;

    /* Defaults de fechas */
    const hoy = new Date();
    const f1 = document.getElementById('fechaInicioAudit');
    const f2 = document.getElementById('fechaFinAudit');
    if (f1 && !f1.value) {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        f1.value = inicio;
    }
    if (f2 && !f2.value) f2.value = hoy.toISOString().split('T')[0];

    document.getElementById('tableSearch')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#auditLogBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    document.getElementById('filtroTipo')?.addEventListener('change', () => {
        if (typeof cargarLogAuditoria === 'function') cargarLogAuditoria();
    });

});
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('beneficios')) return;

    const session = getSession();
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
    set('nivelSocio', session.nivel || 'Socio Activo');
    const firstName = (session.nombre || 'Socio').split(' ')[0];
    document.querySelectorAll('.user-first-name, #benNombreUsuario').forEach(el => el.textContent = firstName);

    const ICONOS = {
        tasa_especial: { icon: 'fa-percent', color: 'bi-green' },
        taller: { icon: 'fa-graduation-cap', color: 'bi-blue' },
        seguro: { icon: 'fa-shield-heart', color: 'bi-purple' },
        descuento: { icon: 'fa-tags', color: 'bi-yellow' },
        abono_capital: { icon: 'fa-piggy-bank', color: 'bi-green' },
        general: { icon: 'fa-star', color: 'bi-purple' }
    };

    async function cargarPuntos() {
        try {
            const res = await apiFetch('/beneficios/puntos');
            if (!res?.ok) return { acumulados: 0, disponibles: 0 };
            const d = await res.json();
            set('puntosUsuario', d.disponibles ?? 0);
            set('kpiPuntos', d.acumulados ?? 0);
            return d;
        } catch { return { acumulados: 0, disponibles: 0 }; }
    }

    const TIPO_LABEL = { GANADO: 'Ganado', CANJEADO: 'Canjeado', AJUSTE: 'Ajuste' };
    async function cargarHistorialPuntos() {
        const tbody = document.getElementById('historialPuntosList');
        if (!tbody) return;
        try {
            const res = await apiFetch('/beneficios/puntos/historial');
            if (!res?.ok) throw new Error();
            const items = await res.json();
            if (!items.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Aún no tienes movimientos de puntos.</td></tr>';
                return;
            }
            tbody.innerHTML = items.map(it => {
                const esGanado = it.tipo === 'GANADO';
                const signo = esGanado ? '+' : (it.tipo === 'CANJEADO' ? '-' : '');
                const color = esGanado ? 'var(--success)' : (it.tipo === 'CANJEADO' ? 'var(--danger)' : 'var(--text-muted)');
                const fecha = it.fecha ? new Date(it.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                return `<tr>
                    <td>${fecha}</td>
                    <td>${TIPO_LABEL[it.tipo] || it.tipo}</td>
                    <td style="color:${color};font-weight:700">${signo}${Math.abs(it.puntos)}</td>
                    <td>${it.descripcion || '—'}</td>
                </tr>`;
            }).join('');
        } catch {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No se pudo cargar el historial.</td></tr>';
        }
    }

    function tarjetaBeneficio(b, disponibles) {
        const cfg = ICONOS[b.tipo] || ICONOS.general;
        const tieneCosto = b.costoPuntos && b.costoPuntos > 0;
        const puedeCanjear = tieneCosto && disponibles >= b.costoPuntos;

        let footer;
        if (tieneCosto) {
            footer = `<button class="${puedeCanjear ? 'btn-ben-primary' : 'btn-ben-secondary'}"
                    data-action="canjear-beneficio" data-id="${b.id}" data-titulo="${b.titulo || ''}" data-costo="${b.costoPuntos}"
                    ${puedeCanjear ? '' : 'disabled style="opacity:.6;cursor:not-allowed"'}>
                    <i class="fa-solid fa-gift"></i> Canjear (${b.costoPuntos} pts)
                </button>`;
        } else if (b.tipo === 'tasa_especial') {
            footer = `<button class="btn-ben-secondary" data-action="solicitar-beneficio" data-id="${b.id}">
                    <i class="fa-solid fa-paper-plane"></i> Solicitar Aplicación
                </button>`;
        } else if (b.tipo === 'taller') {
            footer = `<a href="educacion.html" class="btn-ben-outline"><i class="fa-solid fa-arrow-right"></i> Ver Cursos</a>`;
        } else {
            footer = `<button class="btn-ben-outline" data-action="ver-codigos-beneficios">
                    <i class="fa-solid fa-circle-info"></i> Ver Detalles
                </button>`;
        }

        return `
            <div class="ben-card">
                <div class="ben-card-top">
                    <div class="ben-ic ${cfg.color}"><i class="fa-solid ${cfg.icon}"></i></div>
                    <h3>${b.titulo || 'Beneficio'}</h3>
                    <p>${b.descripcion || ''}${b.tasaEspecial ? ` Tasa especial: <strong>${b.tasaEspecial}%</strong> E.M.` : ''}</p>
                </div>
                <div class="ben-card-footer">${footer}</div>
            </div>`;
    }

    async function cargarBeneficios() {
        const container = document.getElementById('beneficiosContainer');
        if (!container) return;
        if (!container.dataset.listenerAttached) {
            container.dataset.listenerAttached = '1';
            container.addEventListener('click', (e) => {
                const canjear = e.target.closest('[data-action="canjear-beneficio"]');
                if (canjear) { canjearBeneficioPuntos(Number(canjear.dataset.id), canjear.dataset.titulo, Number(canjear.dataset.costo)); return; }
                const solicitar = e.target.closest('[data-action="solicitar-beneficio"]');
                if (solicitar) { solicitarBeneficio(Number(solicitar.dataset.id)); return; }
                const verCodigos = e.target.closest('[data-action="ver-codigos-beneficios"]');
                if (verCodigos) verCodigosBeneficios();
            });
        }
        const puntos = await cargarPuntos();
        cargarHistorialPuntos();
        try {
            const res = await apiFetch('/beneficios');
            if (!res?.ok) throw new Error();
            const data = await res.json();
            if (data.length) {
                container.innerHTML = data.map(b => tarjetaBeneficio(b, puntos.disponibles || 0)).join('');
                set('kpiBenActivos', data.length);
            }
            const tasaEsp = data.find(b => b.tasaEspecial);
            if (tasaEsp) set('kpiTasaEsp', tasaEsp.tasaEspecial + '%');
        } catch {

            mostrarToast('No se pudo conectar con el servidor de beneficios. Mostrando información general.', 'warning');
        }
    }

    window.canjearBeneficioPuntos = async (id, titulo, costo) => {
        if (!confirm(`¿Canjear "${titulo}" por ${costo} puntos?`)) return;
        try {
            const res = await apiFetch(`/beneficios/${id}/canjear`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            mostrarToast(data.mensaje || (res.ok ? 'Beneficio canjeado ✅' : 'No se pudo canjear'), res.ok ? 'success' : 'error');
            if (res.ok) cargarBeneficios(); // refrescar puntos y estado de las tarjetas
        } catch { mostrarToast('Error de conexión', 'error'); }
    };

    window.solicitarBeneficio = async (id) => {
        try {
            const res = await apiFetch('/beneficios/reservar', { method: 'POST', body: JSON.stringify({ beneficioId: id }) });
            const data = await res.json().catch(() => ({}));
            mostrarToast(data.mensaje || '¡Solicitud enviada!', res.ok ? 'success' : 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
    };

    window.verCodigosBeneficios = async () => {
        try {
            const res = await apiFetch('/beneficios/codigos');
            const data = await res.json();
            const codigos = data.map(c => `• ${c.codigo} — ${c.descripcion}`).join('\n');
            alert(codigos || 'No tienes códigos disponibles aún.');
        } catch { mostrarToast('Error al cargar códigos', 'error'); }
    };

    cargarBeneficios();
});


/* =============================================================================
   RESPALDO Y RECUPERACIÓN — progreso de backup, storage info
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('respaldo')) return;

    /* Info de almacenamiento */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('usedCapacityPercent', '42% del total');
    set('storageDetails', '8.4 / 20 GB');
    set('kpiStorageUsed', '8.4 GB');

    const bar = document.getElementById('mainStorageBar');
    if (bar) bar.style.width = '42%';

    const nextInfo = document.getElementById('nextBackupInfo');
    if (nextInfo) nextInfo.innerHTML = '<i class="fa-regular fa-calendar-check" style="color:var(--primary)"></i> <span>Mañana a las 02:00 AM</span>';

    /* Historial de backups */
    const hist = document.getElementById('backupHistory');
    if (hist) {
        const hoy = new Date();
        hist.innerHTML = [0, 1, 2, 3].map(i => {
            const d = new Date(hoy - i * 86400000);
            const metodo = i === 0 ? 'Manual' : 'Automático';
            return `<tr>
                <td>${d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style="font-family:var(--font-mono,monospace);font-size:.8rem">v${2026}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${i}</td>
                <td>Sistema</td>
                <td><span class="status-pill ${i === 0 ? 'st-info' : 'st-success'}">${metodo}</span></td>
                <td style="color:var(--text-muted);font-size:.82rem">${(1.2 + i * 0.3).toFixed(1)} GB</td>
                <td><span class="status-pill st-success">Completado</span></td>
                <td style="text-align:right">
                    <button class="btn-secondary" style="font-size:.75rem;padding:.3rem .65rem" title="Restaurar" data-action="restaurar-backup">
                        <i class="fa-solid fa-rotate-left"></i> Restaurar
                    </button>
                </td>
            </tr>`;
        }).join('');
        /* KPIs */
        set('kpiTotalBackups', '4');
        set('kpiUltimoBackup', 'Hoy');
        set('systemStatus', 'Activa');
    }

});


/* =============================================================================
   SEGURIDAD — gráfica de actividad + tabla de auditoría personal
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('seguridad')) return;

    initPaginaSeguridad();
    document.getElementById('filterEvent')?.addEventListener('change', initPaginaSeguridad);
    document.getElementById('downloadPDF')?.addEventListener('click', () => window.print());
});

async function initPaginaSeguridad() {
    const filtro = document.getElementById('filterEvent')?.value || '';

    /* Gráfica de actividad — datos reales de los últimos 7 días */
    const ctx = document.getElementById('securityChart');
    if (ctx && typeof Chart !== 'undefined') {
        const prevChart = Chart.getChart(ctx);
        if (prevChart) prevChart.destroy();

        const hoy = new Date();
        const dias7 = [...Array(7)].map((_, i) => {
            const d = new Date(hoy); d.setDate(hoy.getDate() - (6 - i));
            return d;
        });
        const labels = dias7.map(d => d.toLocaleDateString('es-CO', { weekday: 'short' }));
        const counts = new Array(7).fill(0);

        try {
            const sessionObj = getSession();
            const esAdminChart = (sessionObj.rol || '').toLowerCase() === 'admin';
            const endpointChart = esAdminChart ? '/admin/auditoria' : '/movimientos';
            const resChart = await apiFetch(endpointChart);
            if (resChart?.ok) {
                const items = await resChart.json();
                items.forEach(item => {
                    const raw = item.createdAt || item.fecha;
                    if (!raw) return;
                    const d = new Date(raw);
                    const idx = dias7.findIndex(ref =>
                        ref.getFullYear() === d.getFullYear() &&
                        ref.getMonth() === d.getMonth() &&
                        ref.getDate() === d.getDate());
                    if (idx >= 0) counts[idx]++;
                });
            }
        } catch { /* usar ceros si falla */ }

        new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Eventos',
                    data: counts,
                    backgroundColor: counts.map(v => v > 3 ? 'rgba(239,68,68,.75)' : 'rgba(14,165,233,.75)'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' evento(s)' } }
                },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    /* Actualizar estado 2FA desde configuración del usuario */
    try {
        const resCfg = await apiFetch('/usuarios/configuracion');
        if (resCfg?.ok) {
            const cfg = await resCfg.json();
            const el2fa = document.getElementById('status2FA');
            if (el2fa) {
                const enabled = cfg.mfaEnabled || cfg.mfaCode === 'MFA_ENABLED';
                el2fa.textContent = enabled ? 'Activado ✅' : 'No configurado';
                el2fa.style.color = enabled ? 'var(--success)' : 'var(--text-muted)';
            }
        }
    } catch { /* silencioso */ }

    const tbody = document.getElementById('auditBody');
    if (!tbody) return;
    mostrarCargandoTabla(tbody, 4);

    const session = getSession();
    const esAdmin = (session.rol || '').toLowerCase() === 'admin';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    try {
        if (esAdmin) {
            /* ── ADMIN: log de auditoría completo ── */
            const url = filtro && filtro !== 'all'
                ? `/admin/auditoria?tipo=${filtro}` : '/admin/auditoria';
            const res = await apiFetch(url);
            if (!res?.ok) throw new Error();
            const logs = await res.json();
            const propios = logs.filter(l => !filtro || filtro === 'all'
                ? true : (l.eventType || '').toLowerCase().includes(filtro));
            set('sessionCount', propios.filter(l => l.eventType === 'LOGIN_SUCCESS').length);
            set('sessionCountFull', propios.filter(l => l.eventType === 'LOGIN_SUCCESS').length + ' Dispositivo(s)');
            if (!propios.length) { mostrarVacioTabla(tbody, 'Sin registros en el período', 4); return; }
            tbody.innerHTML = propios.slice(0, 40).map(l => {
                const esAlerta = (l.eventType || '').toUpperCase().includes('FAIL');
                return `<tr>
                <td>${l.createdAt ? new Date(l.createdAt).toLocaleString('es-CO') : '—'}</td>
                <td>${l.eventType || '—'}</td>
                <td>${l.ipAddress || '—'}</td>
                <td><span class="status-badge ${esAlerta ? 'status-danger' : 'status-success'}">
                    ${esAlerta ? 'Alerta' : 'OK'}</span></td>
            </tr>`;
            }).join('');
        } else {
            /* ── SOCIO: actividad derivada de sus movimientos ── */
            const res = await apiFetch('/movimientos');
            const movs = res?.ok ? await res.json() : [];
            /* Cada movimiento se mapea a un "evento" amigable */
            const tipoLabel = {
                deposit: 'Depósito recibido', withdrawal: 'Retiro',
                transfer: 'Transferencia enviada', transfer_sent: 'Transferencia enviada',
                transfer_received: 'Transferencia recibida',
                loan_disbursement: 'Desembolso préstamo', loan_payment: 'Pago cuota préstamo',
                fee: 'Comisión', service_payment: 'Pago de servicio',
                adjustment: 'Ajuste',
            };

            const tiposEgreso = ['withdrawal', 'transfer', 'transfer_sent', 'fee', 'loan_payment', 'adjustment'];
            /* Filtro del select */
            const filtroMap = {
                login: null,  // los socios no ven logins en movimientos
                fallo: null,
                backup: null,
            };
            const movsVisible = filtro && filtro !== 'all' && filtroMap[filtro] !== undefined
                ? [] : movs;

            set('sessionCount', '1');
            set('sessionCountFull', '1 Dispositivo(s)');

            if (!movsVisible.length) {
                mostrarVacioTabla(tbody, 'Sin actividad reciente registrada', 4); return;
            }
            tbody.innerHTML = movsVisible.slice(0, 40).map(m => {
                const label = tipoLabel[m.tipo] || m.tipo || 'Movimiento';
                const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-CO') : '—';
                const signo = tiposEgreso.includes(m.tipo) ? '−' : '+';
                const evento = m.monto != null ? `${label} (${signo} ${formatearCOP(m.monto)})` : label;
                const estado = (m.estado || '').toLowerCase();
                const esFallo = estado === 'failed';
                const esPend = estado === 'pending';
                const claseEstado = esFallo ? 'status-danger' : esPend ? 'status-warning' : 'status-success';
                const textoEstado = esFallo ? 'Fallida' : esPend ? 'Pendiente' : estado === 'reversed' ? 'Revertida' : 'OK';
                return `<tr>
                    <td>${fecha}</td>
                    <td>${evento}</td>
                    <td>—</td>
                    <td><span class="status-badge ${claseEstado}">${textoEstado}</span></td>
                </tr>`;
            }).join('');
        }
    } catch { mostrarVacioTabla(tbody, 'Sin datos de actividad disponibles', 4); }
}


/* =============================================================================
   REPORTES FINANCIEROS
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('reportes-financieros')) return;

    /* Fechas por defecto: primer día del mes actual → hoy */
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const hoyStr = hoy.toISOString().split('T')[0];
    const fi = document.getElementById('fechaInicio');
    const ff = document.getElementById('fechaFin');
    if (fi && !fi.value) fi.value = primerDia;
    if (ff && !ff.value) ff.value = hoyStr;

    cargarReportesFinancieros();

    document.getElementById('btnFiltrarReporte')?.addEventListener('click', cargarReportesFinancieros);
    document.getElementById('btnExportPDF')?.addEventListener('click', () => {
        window.print();
        mostrarToast('Abriendo vista de impresión PDF...', 'info');
    });

    document.getElementById('userInputSearch')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#txBody tr').forEach(tr => {
            tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
});

let _mainChart = null, _distChart = null;

async function cargarReportesFinancieros() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    /* Fechas: backend espera LocalDateTime → añadir T00:00:00 / T23:59:59 */
    const fiVal = document.getElementById('fechaInicio')?.value;
    const ffVal = document.getElementById('fechaFin')?.value;
    const inicio = fiVal ? fiVal + 'T00:00:00' : '';
    const fin = ffVal ? ffVal + 'T23:59:59' : '';
    const params = inicio && fin ? `?inicio=${inicio}&fin=${fin}` : '';

    let data, audits;
    try {
        /* Un solo fetch al endpoint admin correcto */
        const [resReporte, resAuditoria] = await Promise.allSettled([
            apiFetch('/admin/reportes' + params),
            apiFetch('/admin/auditoria' + params)
        ]);

        data = resReporte.status === 'fulfilled' && resReporte.value?.ok
            ? await resReporte.value.json() : null;
        audits = resAuditoria.status === 'fulfilled' && resAuditoria.value?.ok
            ? await resAuditoria.value.json() : [];

        if (!data) throw new Error('Sin datos del servidor');
    } catch (err) {
        console.error('[reportes-financieros]', err);
        mostrarToast('Error al cargar los reportes financieros', 'error');
        /* Mostrar valores neutros en los KPIs para no dejar "---" */
        ['kpiCarteraTotal', 'kpiIndiceMora', 'kpiSociosActivos', 'kpiPrestamosActivos', 'kpiTasaPago']
            .forEach(id => set(id, '—'));
        return;
    }

    /* ── KPIs ── */
    set('kpiCarteraTotal', formatearCOP(data.carteraTotal || data.montoCartera || 0));
    set('kpiIndiceMora', (+(data.indiceMora || 0)).toFixed(1) + '%');
    set('kpiSociosActivos', data.sociosActivos || data.totalUsuarios || '—');
    set('kpiPrestamosActivos', data.prestamosActivos || data.totalPrestamos || '—');
    set('kpiTasaPago', (+(data.tasaPago || 0)).toFixed(1) + '%');

    /* Tendencias */
    const tc = document.getElementById('trendCartera');
    if (tc) {
        const v = data.tendenciaCartera || (data.carteraTotal > 0 ? '↑ Cartera activa' : '—');
        tc.textContent = v;
        tc.className = 'trend ' + (v.includes('↑') || v.includes('+') ? 'up' : 'neutral');
    }
    const tm = document.getElementById('trendMora');
    if (tm) {
        tm.textContent = data.tendenciaMora || '—';
        tm.className = 'trend ' + ((data.indiceMora || 0) > 5 ? 'down' : 'up');
    }
    const ts = document.getElementById('trendSocios');
    if (ts) {
        ts.textContent = data.tendenciaSocios || '+';
        ts.className = 'trend up';
    }

    try {
        /* ── Gráfico Flujo Financiero Mensual ── */
        const ctxMain = document.getElementById('mainChart');
        if (ctxMain && typeof Chart !== 'undefined') {
            const prevMain = Chart.getChart(ctxMain);
            if (prevMain) prevMain.destroy();
            if (_mainChart) { _mainChart.destroy(); _mainChart = null; }

            /* El backend devuelve labels[], ingresos[], egresos[] listos para usar */
            const labels = (data.labels || []).map(l => l);
            const ingData = (data.ingresos || []).map(v => parseFloat(v) || 0);
            const egrData = (data.egresos || []).map(v => parseFloat(v) || 0);

            /* Si no hay datos del backend, generar estructura vacía para los últimos 6 meses */
            let finalLabels = labels, finalIng = ingData, finalEgr = egrData;
            if (!labels.length) {
                const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const hoy = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
                    finalLabels.push(meses[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));
                    finalIng.push(0);
                    finalEgr.push(0);
                }
            }

            _mainChart = new Chart(ctxMain.getContext('2d'), {
                type: 'line',
                data: {
                    labels: finalLabels,
                    datasets: [
                        {
                            label: 'Ingresos', data: finalIng, borderColor: '#22c55e',
                            backgroundColor: 'rgba(34,197,94,.12)', fill: true, tension: 0.4,
                            pointRadius: 4, pointHoverRadius: 6
                        },
                        {
                            label: 'Egresos', data: finalEgr, borderColor: '#ef4444',
                            backgroundColor: 'rgba(239,68,68,.12)', fill: true, tension: 0.4,
                            pointRadius: 4, pointHoverRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: v => '$ ' + (v / 1000000 >= 1
                                    ? (v / 1000000).toFixed(1) + 'M'
                                    : v.toLocaleString('es-CO'))
                            }
                        }
                    }
                }
            });
        }

        /* ── Gráfico Distribución de Riesgo ── */
        const ctxDist = document.getElementById('distChart');
        if (ctxDist && typeof Chart !== 'undefined') {
            const prevDist = Chart.getChart(ctxDist);
            if (prevDist) prevDist.destroy();
            if (_distChart) { _distChart.destroy(); _distChart = null; }
            const activos = +(data.prestamosActivos || 0);
            const enMora = Math.round(activos * (+(data.indiceMora || 0)) / 100);
            const alDia = Math.max(0, activos - enMora);
            const pagados = Math.max(0, +(data.totalPrestamos || 0) - activos);
            _distChart = new Chart(ctxDist.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Al día', 'En mora', 'Pagados'],
                    datasets: [{
                        data: [alDia, enMora, pagados],
                        backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                        borderWidth: 2, hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        /* ── Historial de reportes auditados ── */
        const tbody = document.getElementById('txBody');
        if (tbody) {
            if (!audits.length) {
                mostrarVacioTabla(tbody, 'Sin actividad en el período seleccionado', 4);
            } else {
                tbody.innerHTML = audits.slice(0, 30).map(a => {
                    const esAlerta = (a.eventType || a.accion || '').includes('FAIL');
                    const fecha = a.fecha || a.createdAt
                        ? new Date(a.fecha || a.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—';
                    return `<tr>
                        <td><i class="fa-solid fa-file-chart-column" style="color:var(--primary);margin-right:.4rem"></i>${a.accion || a.eventType || 'Evento'}</td>
                        <td>${fecha}</td>
                        <td><span class="status-badge ${esAlerta ? 'status-warning' : 'status-success'}">${esAlerta ? 'Alerta' : 'Validado'}</span></td>
                        <td class="text-right">
                            <button class="btn-secondary" style="font-size:.75rem;padding:.3rem .65rem" data-action="print">
                                <i class="fa-solid fa-download"></i> PDF
                            </button>
                        </td>
                    </tr>`;
                }).join('');
            }
        }
    } catch (err) {
        console.error('[reportes-financieros] error al renderizar gráficos/tabla', err);

    }
}


/* =============================================================================
   SALUD FINANCIERA — poblar KPIs con datos reales
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('salud-financiera')) return;
    cargarSaludFinanciera();
    document.getElementById('btnActualizar')?.addEventListener('click', cargarSaludFinanciera);
});

async function cargarSaludFinanciera() {
    try {
        const [resMovs, resCtas] = await Promise.all([
            apiFetch('/movimientos'), apiFetch('/cuentas')
        ]);
        const movs = resMovs?.ok ? await resMovs.json() : [];
        const cuentas = resCtas?.ok ? await resCtas.json() : [];

        const ingresos = movs.filter(m => ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo))
            .reduce((s, m) => s + (m.monto || 0), 0);
        const egresos = movs.filter(m => !['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo))
            .reduce((s, m) => s + (m.monto || 0), 0);
        const saldo = cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
        const eficiencia = ingresos > 0 ? Math.min(100, Math.round(((ingresos - egresos) / ingresos) * 100)) : 0;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('valIngresos', formatearCOP(ingresos));
        set('valEgresos', formatearCOP(egresos));
        set('valSaldo', formatearCOP(saldo));
        set('pctIngresos', '+' + Math.round((ingresos / (ingresos + egresos || 1)) * 100) + '% vs mes ant.');
        set('pctEgresos', Math.round((egresos / (ingresos + egresos || 1)) * 100) + '% del ingreso');
        set('lblEficiencia', eficiencia + '% Eficiencia');
        set('kpiNumMovs', movs.length);

        // Score visual
        const score = Math.min(100, Math.max(0, eficiencia));
        set('scoreFinanciero', score);
        set('labelScore', score >= 70 ? '🟢 Excelente' : score >= 40 ? '🟡 Regular' : '🔴 Crítico');
        const barScore = document.getElementById('barScore');
        if (barScore) barScore.style.width = score + '%';

        const bar = document.getElementById('barEficiencia');
        if (bar) bar.style.width = eficiencia + '%';

        /* Recomendación IA simple */
        const textoIA = document.getElementById('textoRecomendacion');
        if (textoIA) {
            if (eficiencia >= 60) textoIA.textContent = '✅ Tu eficiencia financiera es buena. Sigue ahorrando regularmente.';
            else if (eficiencia >= 30) textoIA.textContent = '⚠️ Tus egresos son altos. Revisa gastos recurrentes y busca reducirlos.';
            else textoIA.textContent = '🔴 Tus gastos superan tus ingresos. Considera reducir gastos no esenciales.';
        }

        /* Lista de movimientos recientes */
        const lista = document.getElementById('listaMovimientos');
        if (lista && movs.length) {
            const tipos = {
                deposit: 'Depósito', withdrawal: 'Retiro', transfer: 'Transferencia',
                fee: 'Servicio', loan_payment: 'Pago Préstamo', loan_disbursement: 'Desembolso', transfer_received: 'Transferencia recibida'
            };
            lista.innerHTML = movs.slice(0, 8).map(m => {
                const esIng = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
                const ini = (m.descripcion || m.tipo || 'TX').substring(0, 2).toUpperCase();
                const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '-';
                return `<div class="mov-item">
                    <div class="mov-ic ${esIng ? 'ingreso' : 'egreso'}">
                        <i class="fa-solid ${esIng ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                    </div>
                    <div class="mov-info">
                        <div class="mn">${tipos[m.tipo] || m.tipo}${m.descripcion ? ' — ' + m.descripcion : ''}</div>
                        <div class="md">${fecha}</div>
                    </div>
                    <div class="mov-amt ${esIng ? 'ingreso' : 'egreso'}">${esIng ? '+' : '-'}${formatearCOP(m.monto)}</div>
                </div>`;
            }).join('');
        }
    } catch { mostrarToast('Error al cargar salud financiera', 'error'); }
}


/* ===== Página: comunidad — tabs + modal evento ===== */

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('comunidad')) return;
    /* ── Tabs: Mis Grupos / Miembros / Publicaciones / Eventos ── */
    if (document.getElementById('tab-publicaciones')) {
        document.querySelectorAll('.tab-bar .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById('tab-' + btn.dataset.tab);
                if (pane) pane.classList.add('active');

                /* Cargar datos del tab al hacer click, por si aún no se han cargado */
                const tab = btn.dataset.tab;
                if (tab === 'publicaciones' && typeof cargarFeedComunidad === 'function') {
                    cargarFeedComunidad();
                } else if (tab === 'miembros' && typeof cargarMiembrosComunidad === 'function') {
                    cargarMiembrosComunidad();
                } else if (tab === 'grupos' && typeof cargarGruposComunidad === 'function') {
                    cargarGruposComunidad();
                } else if (tab === 'eventos' && typeof cargarCalendarioComunidad === 'function') {
                    cargarCalendarioComunidad();
                }
            });
        });
    }
    /* ── Modal Evento (btnNuevoEvento + btnPublicarEvento comparten la misma lógica) ── */
    const modalEvento = document.getElementById('modalEvento');
    const abrirModalEvento = () => {
        if (!modalEvento) return;
        modalEvento.style.display = 'flex';
        const fechaInput = document.getElementById('eventoFecha');
        if (fechaInput && !fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    };
    const cerrarModalEventoLocal = () => { if (modalEvento) modalEvento.style.display = 'none'; };

    document.getElementById('btnNuevoEvento')?.addEventListener('click', abrirModalEvento);
    document.getElementById('cerrarModalEvento')?.addEventListener('click', cerrarModalEventoLocal);
    document.getElementById('cancelarEvento')?.addEventListener('click', cerrarModalEventoLocal);
    modalEvento?.addEventListener('click', e => { if (e.target === modalEvento) cerrarModalEventoLocal(); });

    document.getElementById('formEvento')?.addEventListener('submit', async e => {
        e.preventDefault();
        const titulo = document.getElementById('eventoTitulo').value.trim();
        const desc = document.getElementById('eventoDesc').value.trim();
        const fecha = document.getElementById('eventoFecha').value;
        const hora = document.getElementById('eventoHora').value || '09:00';
        const lugar = document.getElementById('eventoLugar').value.trim();
        if (!titulo) { mostrarToast('El título del evento es requerido', 'warning'); return; }
        if (!fecha) { mostrarToast('Selecciona una fecha', 'warning'); return; }
        const btnSubmit = document.querySelector('#formEvento button[type="submit"]');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...'; }
        try {
            const res = await apiFetch('/comunidad/eventos', {
                method: 'POST',
                body: JSON.stringify({ titulo, descripcion: desc, fecha, hora, lugar })
            });
            if (res?.ok) {
                cerrarModalEventoLocal();
                document.getElementById('formEvento').reset();
                mostrarToast('✅ Evento creado correctamente.', 'success');
                if (typeof cargarCalendarioComunidad === 'function') cargarCalendarioComunidad();
                if (typeof cargarFeedComunidad === 'function') cargarFeedComunidad();
            } else {
                const d = await res?.json().catch(() => ({}));
                mostrarToast('❌ ' + (d.mensaje || 'No se pudo crear el evento.'), 'error');
            }
        } catch {
            mostrarToast('Error al crear evento. Intenta de nuevo.', 'error');
        } finally {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Crear Evento'; }
        }
    });
});


/* =============================================================================
   SEGURIDAD
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('seguridad')) return;

    /* Cargar días desde último cambio de contraseña */
    (async () => {
        try {
            const res = await apiFetch('/usuarios/configuracion');
            if (!res?.ok) return;
            const cfg = await res.json();
            const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

            if (cfg.lastPasswordChange) {
                const dias = Math.floor((Date.now() - new Date(cfg.lastPasswordChange)) / 86400000);
                setEl('pwdDays', dias);
                setEl('pwdExpiry', `Último cambio hace ${dias} día(s)`);
            } else {
                setEl('pwdDays', '—');
                setEl('pwdExpiry', 'Sin registro de cambio');
            }
        } catch { /* silencioso */ }
    })();
});


/* =============================================================================
   TRANSFERENCIAS — contactos frecuentes
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('transferencias')) return;

    /* Cargar contactos frecuentes */
    cargarContactosFrecuentes();

    /* Agregar nuevo contacto — ahora pide email + número de cuenta */
    document.getElementById('btnAgregarContacto')?.addEventListener('click', () => {
        const email = prompt('Correo del contacto (requerido):');
        if (!email?.trim()) return;
        const cuentaNumero = prompt('Número de cuenta Bankomunal del contacto (opcional, pero recomendado para transferir):') || '';
        apiFetch('/contactos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), cuentaNumero: cuentaNumero.trim() })
        }).then(res => {
            if (res?.ok) {
                mostrarToast('✅ Contacto agregado', 'success');
                cargarContactosFrecuentes();
            } else {
                mostrarToast('No se pudo agregar el contacto. Verifica el correo.', 'error');
            }
        }).catch(() => mostrarToast('Error al conectar con el servidor.', 'error'));
    });

    /* Eliminar contacto frecuente — DELETE /contactos/{id} */
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="eliminar-contacto"]');
        if (!btn) return;
        e.stopPropagation();
        if (!confirm(`¿Eliminar a ${btn.dataset.nombre} de tus contactos frecuentes?`)) return;
        apiFetch(`/contactos/${btn.dataset.id}`, { method: 'DELETE' }).then(res => {
            if (res?.ok) {
                mostrarToast('Contacto eliminado', 'success');
                cargarContactosFrecuentes();
            } else {
                mostrarToast('No se pudo eliminar el contacto', 'error');
            }
        }).catch(() => mostrarToast('Error de conexión', 'error'));
    });
});

async function cargarContactosFrecuentes() {
    const strip = document.getElementById('contactosFrecuentes');
    if (!strip) return;


    const addBtn = document.getElementById('btnAgregarContacto');
    const addBtnContainer = addBtn?.parentElement && addBtn.parentElement !== strip
        ? addBtn.parentElement
        : addBtn;

    /* Limpiar contactos previos (no el botón ni su contenedor) */
    strip.querySelectorAll('.cc-contact').forEach(el => el.remove());

    try {
        const res = await apiFetch('/contactos');
        if (!res?.ok) throw new Error();
        const contactos = await res.json();

        if (!contactos?.length) {
            const empty = document.createElement('span');
            empty.className = 'cc-empty';
            empty.style.cssText = 'font-size:.8rem;color:var(--text-muted);align-self:center;';
            empty.textContent = 'Sin contactos frecuentes';
            if (addBtnContainer) strip.insertBefore(empty, addBtnContainer);
            else strip.appendChild(empty);
            return;
        }

        contactos.slice(0, 6).forEach(c => {
            const ini = ((c.nombre || c.email || 'U').substring(0, 2)).toUpperCase();
            const div = document.createElement('div');
            div.className = 'cc-contact';
            div.style.position = 'relative';
            div.title = c.nombre || c.email;
            div.innerHTML = `
                <button data-action="eliminar-contacto" data-id="${c.id}" data-nombre="${(c.nombre || c.email || '').replace(/"/g, '&quot;')}"
                    title="Eliminar contacto"
                    style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;
                        background:var(--danger);color:#fff;border:none;font-size:.6rem;line-height:1;
                        cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="cc-avatar">${ini}</div><div class="cc-name">${(c.nombre || c.email).split(' ')[0]}</div>`;
            div.addEventListener('click', (ev) => {
                if (ev.target.closest('[data-action="eliminar-contacto"]')) return;
                const emailInput = document.getElementById('toAccount');
                if (!emailInput) return;

                // Si el contacto tiene número de cuenta → llenarlo directamente
                if (c.cuentaNumero) {
                    emailInput.value = c.cuentaNumero;
                    emailInput.focus();
                    mostrarToast(`Contacto seleccionado: ${c.nombre || c.email}`, 'info');
                } else {
                    // Solo tiene email: el backend de transferencias requiere número de cuenta,
                    // no email. Mostrar aviso y limpiar el campo para que el usuario ingrese
                    // el número manualmente.
                    emailInput.value = '';
                    emailInput.placeholder = 'Ingresa el número de cuenta de ' + (c.nombre || c.email).split(' ')[0];
                    emailInput.focus();
                    mostrarToast(
                        `${c.nombre || c.email} no tiene número de cuenta guardado. Ingresa su número de cuenta.`,
                        'warning'
                    );
                }
            });
            if (addBtnContainer) strip.insertBefore(div, addBtnContainer);
            else strip.appendChild(div);
        });
    } catch {
        /* Error de red o el endpoint no respondió correctamente */
        const empty = document.createElement('span');
        empty.style.cssText = 'font-size:.8rem;color:var(--text-muted);align-self:center;';
        empty.textContent = 'Sin contactos aún';
        if (addBtnContainer) strip.insertBefore(empty, addBtnContainer);
        else strip.appendChild(empty);
    }
}


/* =============================================================================
   USUARIOS — módulo completo de administración
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('usuarios')) return;
    initPaginaUsuarios();
});

async function initPaginaUsuarios() {
    let todosLosUsuarios = [];
    let paginaActual = 1;
    let filasPorPagina = 10;

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

    /* ── Helpers de tabla ─────────────────────────────────────── */
    function rolBadge(rol) {
        const cls = { ADMIN: 'status-info', SOCIO: 'status-success', ASESOR: 'status-warning' };
        return `<span class="status-badge ${cls[rol] || 'status-neutral'}">${rol || '—'}</span>`;
    }
    function estadoBadge(estado) {
        const activo = (estado || '').toLowerCase() === 'active' || estado === true;
        const label = {
            active: 'Activo', pending: 'Pendiente', suspended: 'Suspendido',
            blocked: 'Bloqueado', deleted: 'Eliminado'
        }[(estado || '').toLowerCase()] || 'Desconocido';
        return `<span class="status-badge ${activo ? 'status-success' : 'status-danger'}">${label}</span>`;
    }

    /* ── Renderizar tabla con filtros + paginación ───────────── */
    function renderTabla() {
        const tbody = document.getElementById('txBody');
        if (!tbody) return;

        const q = (document.getElementById('searchUsuarios')?.value || '').toLowerCase();
        const filtroRol = document.getElementById('filtroRol')?.value || '';
        const filtroEst = document.getElementById('filtroEstado')?.value || '';

        let filtrados = todosLosUsuarios.filter(u => {
            const estadoBackend = (u.estado || '').toLowerCase(); // 'active','blocked','pending','suspended'
            const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
            const textoOk = !q || nombreCompleto.includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.cedula || '').toLowerCase().includes(q);
            const rolOk = !filtroRol || (u.rol || '').toUpperCase() === filtroRol.toUpperCase();
            const estadoOk = !filtroEst || estadoBackend === filtroEst.toLowerCase();
            return textoOk && rolOk && estadoOk;
        });

        const total = filtrados.length;
        const inicio = (paginaActual - 1) * filasPorPagina;
        const pagina = filtrados.slice(inicio, inicio + filasPorPagina);

        /* Paginación */
        const totalPags = Math.max(1, Math.ceil(total / filasPorPagina));
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = `Página ${paginaActual} de ${totalPags}`;
        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.disabled = paginaActual === 1;
        if (next) next.disabled = paginaActual >= totalPags;

        if (!pagina.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">Sin resultados</td></tr>`;
            return;
        }

        tbody.innerHTML = pagina.map(u => {
            const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || '—';
            const activo = (u.estado || '').toLowerCase() === 'active';
            const toggleTxt = activo ? 'Bloquear' : 'Activar';
            const toggleCls = activo ? 'btn-danger-sm' : 'btn-success-sm';
            return `<tr>
                <td>${nombre}</td>
                <td>${u.email || '—'}</td>
                <td>${u.documento || '—'}</td>
                <td>${rolBadge(u.rol)}</td>
                <td>${estadoBadge(u.estado ?? u.activo)}</td>
                <td>${u.fechaRegistro ? new Date(u.fechaRegistro).toLocaleDateString('es-CO') : '—'}</td>
                <td>
                    <button class="btn-icon-sm" title="Ver detalle" data-action="ver-usuario" data-id="${u.id}">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-icon-sm" title="Cambiar rol" data-action="cambiar-rol-usuario" data-id="${u.id}" data-rol="${(u.rol || 'SOCIO').toUpperCase()}">
                        <i class="fa-solid fa-user-gear"></i>
                    </button>
                    <button class="${toggleCls} btn-sm-inline" title="${toggleTxt}"
                        data-action="toggle-estado-usuario" data-id="${u.id}" data-activo="${activo}">
                        ${toggleTxt}
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    /* ── Cargar usuarios desde backend ──────────────────────── */
    async function cargarUsuarios() {
        const tbody = document.getElementById('txBody');
        if (tbody) mostrarCargandoTabla(tbody, 7);
        try {
            const res = await apiFetch('/admin/usuarios');
            if (!res?.ok) throw new Error();
            todosLosUsuarios = await res.json();

            /* KPIs — usa 'active'/'blocked' en minúsculas */
            set('kpiTotal', todosLosUsuarios.length);
            set('kpiActivos', todosLosUsuarios.filter(u => (u.estado || '').toLowerCase() === 'active').length);
            set('kpiBloqueados', todosLosUsuarios.filter(u => (u.estado || '').toLowerCase() === 'blocked').length);
            set('kpiAdmins', todosLosUsuarios.filter(u => (u.rol || '').toUpperCase() === 'ADMIN').length);

            paginaActual = 1;
            renderTabla();
        } catch {
            const tbody = document.getElementById('txBody');
            if (tbody) mostrarVacioTabla(tbody, 'No se pudieron cargar los usuarios. Verifica tu sesión.', 7);
        }
    }

    /* ── Filtros y búsqueda ──────────────────────────────────── */
    document.getElementById('searchUsuarios')?.addEventListener('input', () => { paginaActual = 1; renderTabla(); });
    document.getElementById('filtroRol')?.addEventListener('change', () => { paginaActual = 1; renderTabla(); });
    document.getElementById('filtroEstado')?.addEventListener('change', () => { paginaActual = 1; renderTabla(); });

    /* ── Paginación ──────────────────────────────────────────── */
    document.getElementById('prevPage')?.addEventListener('click', () => { if (paginaActual > 1) { paginaActual--; renderTabla(); } });
    document.getElementById('nextPage')?.addEventListener('click', () => { paginaActual++; renderTabla(); });
    document.getElementById('rowsPerPage')?.addEventListener('change', (e) => {
        filasPorPagina = parseInt(e.target.value) || 10;
        paginaActual = 1;
        renderTabla();
    });

    /* ── Modal nuevo usuario ─────────────────────────────────── */
    const modalNuevo = document.getElementById('modalNuevoUsuario');
    const abrirModal = () => {
        if (modalNuevo) { modalNuevo.classList.remove('hidden'); modalNuevo.style.display = 'flex'; }
        document.getElementById('formNuevoUsuario')?.reset();
    };
    const cerrarModal = () => {
        if (modalNuevo) { modalNuevo.classList.add('hidden'); modalNuevo.style.display = 'none'; }
    };

    document.getElementById('btnNuevoUsuario')?.addEventListener('click', abrirModal);
    document.getElementById('btnCerrarModalUsuario')?.addEventListener('click', cerrarModal);
    document.getElementById('btnCancelarUsuario')?.addEventListener('click', cerrarModal);
    modalNuevo?.addEventListener('click', e => { if (e.target === modalNuevo) cerrarModal(); });

    /* ── Submit formulario nuevo usuario ─────────────────────── */
    document.getElementById('formNuevoUsuario')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.closest('.modal-card')?.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando…'; }

        const payload = {
            nombres: document.getElementById('inputNombre')?.value?.trim() || '',
            email: document.getElementById('inputEmail')?.value?.trim() || '',
            documento: document.getElementById('inputCedula')?.value?.trim() || '',
            telefono: document.getElementById('inputTelefono')?.value?.trim() || '',
            rol: document.getElementById('inputRol')?.value || 'SOCIO',
            password: document.getElementById('inputPassword')?.value || 'Temporal2024!',
        };

        try {
            const res = await apiFetch('/admin/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res?.json().catch(() => ({}));

            if (res?.ok) {
                mostrarToast('✅ Usuario creado correctamente.', 'success');
                cerrarModal();
                cargarUsuarios();
            } else {
                mostrarToast('❌ ' + (data?.mensaje || 'Error al crear el usuario.'), 'error');
            }
        } catch {
            mostrarToast('⚠️ Error al conectar con el servidor.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Usuario'; }
        }
    });

    /* ── Carga inicial ──────────────────────────────────────── */
    await cargarUsuarios();
}

document.getElementById('txBody')?.addEventListener('click', (e) => {
    const verBtn = e.target.closest('[data-action="ver-usuario"]');
    if (verBtn) { verDetalleUsuario(Number(verBtn.dataset.id)); return; }
    const rolBtn = e.target.closest('[data-action="cambiar-rol-usuario"]');
    if (rolBtn) { cambiarRolUsuario(Number(rolBtn.dataset.id), rolBtn.dataset.rol); return; }
    const toggleBtn = e.target.closest('[data-action="toggle-estado-usuario"]');
    if (toggleBtn) toggleEstadoUsuario(Number(toggleBtn.dataset.id), toggleBtn.dataset.activo === 'true');
});

/* Funciones globales para la tabla de usuarios (antes invocadas via onclick) */
window.verDetalleUsuario = async function (id) {
    try {
        const res = await apiFetch(`/admin/usuarios/${id}`);
        if (!res?.ok) throw new Error();
        const u = await res.json();
        const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim() || '—';
        alert(`👤 ${nombre}\nEmail: ${u.email}\nCédula: ${u.cedula || '—'}\nRol: ${u.rol}\nEstado: ${u.estado || '—'}\nRegistro: ${u.fechaRegistro ? new Date(u.fechaRegistro).toLocaleDateString('es-CO') : '—'}`);
    } catch { mostrarToast('No se pudo cargar el detalle del usuario.', 'error'); }
};

window.toggleEstadoUsuario = async function (id, estaActivo) {
    const accion = estaActivo ? 'bloquear' : 'activar';
    if (!confirm(`¿Deseas ${accion} este usuario?`)) return;
    try {
        const res = await apiFetch(`/admin/usuarios/${id}/${accion}`, { method: 'PUT' });
        if (res?.ok) {
            mostrarToast(`✅ Usuario ${estaActivo ? 'bloqueado' : 'activado'} correctamente.`, 'success');
            initPaginaUsuarios();
        } else {
            mostrarToast('No se pudo cambiar el estado del usuario.', 'error');
        }
    } catch { mostrarToast('Error al conectar con el servidor.', 'error'); }
};

window.cambiarRolUsuario = async function (id, rolActual) {
    const nuevoRol = prompt(
        `Rol actual: ${rolActual}\n\nEscribe el nuevo rol (SOCIO, TESORERO o ADMIN):`,
        rolActual
    );
    if (!nuevoRol?.trim()) return;
    const rolNormalizado = nuevoRol.trim().toUpperCase();
    if (!['SOCIO', 'TESORERO', 'ADMIN'].includes(rolNormalizado)) {
        return mostrarToast('Rol no válido. Usa SOCIO, TESORERO o ADMIN.', 'warning');
    }
    if (rolNormalizado === rolActual) return;

    try {
        const res = await apiFetch(`/admin/usuarios/${id}/rol`, {
            method: 'PATCH',
            body: JSON.stringify({ rol: rolNormalizado })
        });
        if (res?.ok) {
            mostrarToast(`✅ Rol actualizado a ${rolNormalizado}.`, 'success');
            initPaginaUsuarios();
        } else {
            const d = await res?.json().catch(() => ({}));
            mostrarToast(d.mensaje || 'No se pudo cambiar el rol.', 'error');
        }
    } catch { mostrarToast('Error al conectar con el servidor.', 'error'); }
};


/* =============================================================================
   perfil, préstamos, reportes, respaldo, roles, salud
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('perfil')) return;

    /* Tabs */
    document.querySelectorAll('.pf-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.pf-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.pf-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const pane = document.getElementById('pane-' + target);
            if (pane) pane.classList.add('active');

            /* Cargar docs solo cuando el tab se abre */
            if (target === 'documentos') cargarDocsPerfil();
        });
    });
});

/* Cargar documentos del usuario en el tab Documentos */
async function cargarDocsPerfil() {
    const container = document.getElementById('profileDocs');
    if (!container || container.dataset.loaded) return;
    container.innerHTML = '<div style="text-align:center;padding:2rem"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    try {
        const res = await apiFetch('/documentos');
        if (!res?.ok) throw new Error();
        const docs = await res.json();
        if (!docs?.length) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No tienes documentos adjuntos aún.<br><a href="documentos.html">Ir a Gestión de Documentos →</a></p>';
        } else {
            container.innerHTML = docs.map(d => `
                <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 0;border-bottom:1px solid var(--border)">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--primary-light,#e0f2fe);color:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:.84rem;font-weight:600">${d.nombre || d.tipoDocumento || 'Documento'}</div>
                        <div style="font-size:.72rem;color:var(--text-muted)">${d.fechaSubida ? new Date(d.fechaSubida).toLocaleDateString('es-CO') : ''}</div>
                    </div>
                    <span class="status-badge ${d.estado === 'APROBADO' ? 'status-success' : d.estado === 'RECHAZADO' ? 'status-danger' : 'status-warning'}">${d.estado || 'Pendiente'}</span>
                </div>`).join('');
        }
        container.dataset.loaded = '1';
    } catch {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No se pudieron cargar los documentos.</p>';
    }
}


/* ─────────────────────────────────────────────────────────────────────────────
   PRÉSTAMOS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('prestamos')) return;

    document.getElementById('btnSolicitarPrestamo')?.addEventListener('click', () => {
        // Buscar el formulario de simulación
        const simCards = document.querySelectorAll('.sim-card');
        const formCard = Array.from(simCards).find(c => c.querySelector('#montoInput')) || simCards[0];
        if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            formCard.classList.remove('highlight-pulse');
            void formCard.offsetWidth; // forzar reflow para poder re-disparar la animación
            formCard.classList.add('highlight-pulse');
            setTimeout(() => {
                const input = document.getElementById('montoInput');
                if (input) { input.focus(); input.select(); }
            }, 400);
        }
    });

    /* Proyectar ahorro — rango meses */
    const mesesRange = document.getElementById('mesesRange');
    const lblMeses = document.getElementById('lblMeses');
    const ahorroInput = document.getElementById('ahorroMensual');
    const ahorroResult = document.getElementById('ahorroResult');

    function calcularAhorro() {
        // Limpiar separadores de miles antes de parsear
        const raw = (ahorroInput?.value || '').replace(/\./g, '').replace(/,/g, '');
        const mensual = parseFloat(raw) || 0;
        const meses = parseInt(mesesRange?.value || 12);
        if (lblMeses) lblMeses.textContent = meses;
        const tasa = 0.005; // 0.5% E.M.
        const total = mensual > 0
            ? mensual * ((Math.pow(1 + tasa, meses) - 1) / tasa) * (1 + tasa)
            : 0;
        if (ahorroResult) ahorroResult.textContent = formatearCOP(total);
    }

    // Money mask para ahorro mensual
    ahorroInput?.addEventListener('input', () => {
        const pos = ahorroInput.selectionStart;
        const raw = ahorroInput.value.replace(/\D/g, '');
        const num = parseInt(raw) || 0;
        ahorroInput.value = num > 0 ? num.toLocaleString('es-CO') : '';
        calcularAhorro();
    });
    mesesRange?.addEventListener('input', calcularAhorro);
    calcularAhorro(); // inicial

    /* Money mask + cálculo cuota en tiempo real */
    const montoInput = document.getElementById('montoInput');
    const cuotaResult = document.getElementById('cuotaResult');
    const plazoSelect = document.getElementById('plazoSelect');

    const tasas = { '6': 0.020, '12': 0.018, '24': 0.015 };

    function calcularCuota() {
        const raw = (montoInput?.value || '').replace(/\D/g, '');
        const monto = parseInt(raw) || 0;
        const plazo = parseInt(plazoSelect?.value) || 12;
        const tasa = tasas[String(plazo)] || 0.018;
        /* Cuota = P * [i(1+i)^n] / [(1+i)^n - 1] */
        const cuota = monto > 0 && tasa > 0
            ? monto * (tasa * Math.pow(1 + tasa, plazo)) / (Math.pow(1 + tasa, plazo) - 1)
            : 0;
        if (cuotaResult) cuotaResult.textContent = formatearCOP(cuota);

        /* Money mask: format display */
        if (montoInput) {
            const formatted = monto > 0 ? monto.toLocaleString('es-CO') : '';
            const cursor = montoInput.selectionStart;
            montoInput.value = formatted;
            try { montoInput.setSelectionRange(cursor, cursor); } catch { }
        }
    }

    montoInput?.addEventListener('input', calcularCuota);
    plazoSelect?.addEventListener('change', calcularCuota);
    calcularCuota(); // inicial
});


/* ─────────────────────────────────────────────────────────────────────────────
   RESPALDO-RECUPERACION
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('respaldo')) return;
    document.getElementById('btnRefreshBackups')?.addEventListener('click', () => {
        mostrarToast('Actualizando historial...', 'info');

        setTimeout(() => location.reload(), 800);
    });
});


/* ─────────────────────────────────────────────────────────────────────────────
   ROLES-PERMISOS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('roles-permisos')) return;
    initPaginaRoles();
});

const PERMISOS_MODULOS = [
    'Dashboard', 'Préstamos', 'Transferencias', 'Usuarios', 'Reportes',
    'Configuración', 'Seguridad', 'Documentos', 'Educación', 'Soporte'
];

/* Permisos por defecto por rol */
const PERMISOS_DEFAULT = {
    ADMIN: PERMISOS_MODULOS.map(m => ({ modulo: m, leer: true, crear: true, editar: true, borrar: true })),
    SOCIO: PERMISOS_MODULOS.map(m => ({ modulo: m, leer: true, crear: false, editar: false, borrar: false })),
    ASESOR: PERMISOS_MODULOS.map(m => ({ modulo: m, leer: true, crear: true, editar: true, borrar: false })),
};

let _rolesData = [];
let _rolSeleccionado = null;
let _permisosActuales = [];
let _chartRoles = null;

async function initPaginaRoles() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    /* Cargar roles desde backend o usar defaults */
    try {
        const res = await apiFetch('/admin/roles');
        if (res?.ok) _rolesData = await res.json();
        else throw new Error();
    } catch {
        _rolesData = [
            { id: 1, nombre: 'ADMIN', descripcion: 'Acceso total al sistema', usuarios: 0 },
            { id: 2, nombre: 'SOCIO', descripcion: 'Socio comunitario', usuarios: 0 },
            { id: 3, nombre: 'ASESOR', descripcion: 'Asesor financiero', usuarios: 0 },
        ];
    }

    /* KPIs generales */
    try {
        const [resU, resS] = await Promise.allSettled([
            apiFetch('/admin/usuarios'),
            apiFetch('/admin/auditoria?tipo=LOGIN_SUCCESS')
        ]);
        const usuarios = resU.status === 'fulfilled' && resU.value?.ok ? await resU.value.json() : [];
        const sesiones = resS.status === 'fulfilled' && resS.value?.ok ? await resS.value.json() : [];
        const bloqs = usuarios.filter(u => u.estado === 'BLOQUEADO' || u.activo === false).length;
        set('totalUsuariosRoles', usuarios.length);
        set('sesionesActivas', sesiones.filter(l => {
            const d = l.createdAt ? new Date(l.createdAt) : null;
            return d && (Date.now() - d) < 86400000;
        }).length);
        set('intentosFallidos', bloqs);

        /* Contar usuarios por rol para _rolesData */
        _rolesData.forEach(r => {
            r.usuarios = usuarios.filter(u => u.rol === r.nombre).length;
        });
    } catch { /* silencioso */ }

    set('kpiTotalRoles', _rolesData.length);
    renderRolesList();
    renderChartRoles();

    /* Botón Nuevo Rol */
    const modalRol = document.getElementById('modalRol');
    const cerrarModal = () => {
        if (modalRol) { modalRol.classList.add('hidden'); modalRol.style.display = 'none'; }
    };
    document.getElementById('btnNuevoRol')?.addEventListener('click', () => {
        if (modalRol) { modalRol.classList.remove('hidden'); modalRol.style.display = 'flex'; }
        document.getElementById('inputNombreRol')?.focus();
    });
    document.getElementById('btnCloseRol')?.addEventListener('click', cerrarModal);
    document.getElementById('btnCancelarRol')?.addEventListener('click', cerrarModal);
    modalRol?.addEventListener('click', e => { if (e.target === modalRol) cerrarModal(); });

    document.getElementById('btnConfirmarRol')?.addEventListener('click', async () => {
        const nombre = document.getElementById('inputNombreRol')?.value?.trim().toUpperCase();
        const desc = document.getElementById('inputDescRol')?.value?.trim() || '';
        if (!nombre) { mostrarToast('El nombre del rol es obligatorio', 'warning'); return; }
        try {
            const res = await apiFetch('/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, descripcion: desc })
            });
            if (res?.ok) {
                const nuevo = await res.json();
                _rolesData.push({ ...nuevo, usuarios: 0 });
            } else {
                _rolesData.push({ id: Date.now(), nombre, descripcion: desc, usuarios: 0 });
            }
        } catch {
            _rolesData.push({ id: Date.now(), nombre, descripcion: desc, usuarios: 0 });
        }
        mostrarToast(`✅ Rol "${nombre}" creado`, 'success');
        set('kpiTotalRoles', _rolesData.length);
        renderRolesList();
        renderChartRoles();
        cerrarModal();
    });

    /* Guardar permisos */
    document.getElementById('btnSavePermissions')?.addEventListener('click', async () => {
        if (!_rolSeleccionado) { mostrarToast('Selecciona un rol primero', 'warning'); return; }
        /* Leer checkboxes actuales */
        const permisos = PERMISOS_MODULOS.map((modulo, i) => ({
            modulo,
            leer: document.getElementById(`chk-leer-${i}`)?.checked || false,
            crear: document.getElementById(`chk-crear-${i}`)?.checked || false,
            editar: document.getElementById(`chk-editar-${i}`)?.checked || false,
            borrar: document.getElementById(`chk-borrar-${i}`)?.checked || false,
        }));
        const btn = document.getElementById('btnSavePermissions');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando…'; }
        try {
            await apiFetch(`/admin/roles/${_rolSeleccionado.id}/permisos`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rolId: _rolSeleccionado.id, permisos })
            });
        } catch { /* backend no tiene el endpoint aún — guardado local */ }
        _permisosActuales = permisos;
        mostrarToast(`✅ Permisos de ${_rolSeleccionado.nombre} actualizados`, 'success');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Aplicar Cambios'; }
    });

    /* Exportar PDF */
    document.getElementById('btnExportarPermisos')?.addEventListener('click', () => {
        window.print();
        mostrarToast('Abriendo vista de impresión...', 'info');
    });
}

document.getElementById('rolesList')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action="seleccionar-rol"]');
    if (item) seleccionarRol(Number(item.dataset.id));
});

function renderRolesList() {
    const container = document.getElementById('rolesList');
    if (!container) return;
    container.innerHTML = _rolesData.map(r => `
        <div class="role-item ${_rolSeleccionado?.id === r.id ? 'selected' : ''}"
             style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;border-radius:8px;cursor:pointer;margin-bottom:.35rem;background:${_rolSeleccionado?.id === r.id ? 'var(--primary-light,#e0f2fe)' : 'transparent'};transition:background .2s"
             data-action="seleccionar-rol" data-id="${r.id}">
            <div>
                <div style="font-size:.83rem;font-weight:600">${r.nombre}</div>
                <div style="font-size:.71rem;color:var(--text-muted)">${r.descripcion || ''} · ${r.usuarios || 0} usuario(s)</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size:.7rem;color:var(--text-muted)"></i>
        </div>`).join('');
}

function renderChartRoles() {
    const ctx = document.getElementById('chartRoles');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_chartRoles) _chartRoles.destroy();
    _chartRoles = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: _rolesData.map(r => r.nombre),
            datasets: [{
                data: _rolesData.map(r => r.usuarios || 1),
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
        }
    });
}

window.seleccionarRol = async function (id) {
    _rolSeleccionado = _rolesData.find(r => r.id === id);
    if (!_rolSeleccionado) return;
    renderRolesList(); // re-render con el selected resaltado

    const title = document.getElementById('currentRoleTitle');
    if (title) title.textContent = _rolSeleccionado.nombre;

    /* Cargar permisos del rol desde backend o usar defaults */
    try {
        const res = await apiFetch(`/admin/roles/${id}/permisos`);
        if (res?.ok) _permisosActuales = await res.json();
        else throw new Error();
    } catch {
        _permisosActuales = PERMISOS_DEFAULT[_rolSeleccionado.nombre] || PERMISOS_DEFAULT.SOCIO;
    }

    /* Renderizar tabla de permisos con checkboxes */
    const tbody = document.getElementById('rolesTableBody');
    if (!tbody) return;
    tbody.innerHTML = PERMISOS_MODULOS.map((modulo, i) => {
        const p = _permisosActuales[i] || { leer: false, crear: false, editar: false, borrar: false };
        const chk = (tipo) => `<input type="checkbox" id="chk-${tipo}-${i}" ${p[tipo] ? 'checked' : ''}
            style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">`;
        return `<tr>
            <td><strong style="font-size:.83rem">${modulo}</strong></td>
            <td style="text-align:center">${chk('leer')}</td>
            <td style="text-align:center">${chk('crear')}</td>
            <td style="text-align:center">${chk('editar')}</td>
            <td style="text-align:center">${chk('borrar')}</td>
        </tr>`;
    }).join('');
};


/* ─────────────────────────────────────────────────────────────────────────────
   SALUD-FINANCIERA
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('salud-financiera')) return;

    /* Poblar selector de años */
    const anioSel = document.getElementById('filtroAnio');
    if (anioSel) {
        const anioActual = new Date().getFullYear();
        for (let a = anioActual; a >= anioActual - 3; a--) {
            const opt = document.createElement('option');
            opt.value = a; opt.textContent = a;
            if (a === anioActual) opt.selected = true;
            anioSel.appendChild(opt);
        }
    }

    /* Mes actual por defecto */
    const mesSel = document.getElementById('filtroMes');
    if (mesSel) mesSel.value = String(new Date().getMonth() + 1);

    /* Botón actualizar sidebar */
    document.getElementById('btnActualizarSide')?.addEventListener('click', cargarSaludFinanciera);

    /* Cambios en filtros mes/año disparan recarga */
    mesSel?.addEventListener('change', cargarSaludFinanciera);
    anioSel?.addEventListener('change', cargarSaludFinanciera);
});

/* Patch para que cargarSaludFinanciera dibuje healthChart */
/* Guardamos la función original y la sobreescribimos con soporte de gráfico */
const _cargarSaludOriginal = window.cargarSaludFinanciera;
let _healthChart = null;

window.cargarSaludFinanciera = async function () {

    if (typeof _cargarSaludOriginal === 'function') await _cargarSaludOriginal();

    /* Dibujar healthChart con los datos de movimientos */
    const ctx = document.getElementById('healthChart');
    if (!ctx || typeof Chart === 'undefined') return;
    try {
        const res = await apiFetch('/movimientos');
        if (!res?.ok) return;
        const movs = await res.json();

        const mes = parseInt(document.getElementById('filtroMes')?.value || new Date().getMonth() + 1);
        const anio = parseInt(document.getElementById('filtroAnio')?.value || new Date().getFullYear());
        const filtrados = movs.filter(m => {
            if (!m.fecha) return false;
            const d = new Date(m.fecha);
            return d.getMonth() + 1 === mes && d.getFullYear() === anio;
        });

        /* Agrupar por tipo de gasto */
        const categorias = {};
        filtrados.filter(m => !['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo))
            .forEach(m => {
                const cat = m.tipo === 'loan_payment' ? 'Préstamos'
                    : m.tipo === 'fee' ? 'Comisiones'
                        : m.tipo === 'withdrawal' ? 'Retiros'
                            : m.tipo === 'transfer' ? 'Transferencias' : 'Otros';
                categorias[cat] = (categorias[cat] || 0) + (m.monto || 0);
            });

        if (_healthChart) _healthChart.destroy();
        const labels = Object.keys(categorias);
        const data = Object.values(categorias);
        _healthChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sin gastos'],
                datasets: [{
                    data: data.length ? data : [1],
                    backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
            }
        });
    } catch { /* silencioso */ }
};


/* =============================================================================
   educacion, encuestas, historial-analisis, historial, notificaciones, pagos
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('educacion')) return;

    /* Patch renderLeccion para usar IDs correctos del HTML */
    window._renderLeccionOrig = window.renderLeccion;
    window.renderLeccion = function () {
        if (!window.cursoActual) return;
        const lec = window.cursoActual.lecciones[window.leccionActual];
        if (!lec) return;

        /* IDs reales del HTML */
        const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
        const setTx = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

        setTx('lessonCursoNombre', window.cursoActual.titulo +
            ` — Lección ${window.leccionActual + 1}/${window.cursoActual.lecciones.length}`);
        setTx('lessonTitulo', lec.titulo);
        setEl('lessonContenido',
            (lec.contenido || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'));

        /* Progress fill */
        const fill = document.getElementById('lessonProgressFill');
        const pct = Math.round(((window.leccionActual + 1) / window.cursoActual.lecciones.length) * 100);
        if (fill) fill.style.width = pct + '%';

        const quizBlock = document.getElementById('quizBlock');
        const sigBtn = document.getElementById('btnSiguienteLeccion');

        /* Si es lección final → mostrar modal certificado */
        if (lec.esFinal) {
            if (quizBlock) quizBlock.style.display = 'none';
            if (sigBtn) sigBtn.textContent = 'Finalizar curso';
            /* Preparar modal certificado */
            const certNombre = document.getElementById('certCursoNombre');
            if (certNombre) certNombre.textContent = window.cursoActual.titulo;
        } else {
            if (quizBlock) quizBlock.style.display = lec.quiz ? 'block' : 'none';
            if (sigBtn) sigBtn.textContent = 'Siguiente';

            if (lec.quiz && quizBlock) {
                const pEl = document.getElementById('quizPregunta');
                const oEl = document.getElementById('quizOpciones');
                const rEl = document.getElementById('quizResultado');
                if (pEl) pEl.textContent = lec.quiz.pregunta;
                if (oEl) oEl.innerHTML = lec.quiz.opciones.map((op, i) =>
                    `<label style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;cursor:pointer">
                        <input type="radio" name="quiz" value="${i}"> ${op}
                    </label>`).join('');
                if (rEl) rEl.textContent = '';
            }
        }

        const prevBtn = document.getElementById('btnAnteriorLeccion');
        if (prevBtn) prevBtn.disabled = window.leccionActual === 0;
    };

    /* Patch abrirCurso para llamar al renderLeccion corregido */
    window._abrirCursoOrig = window.abrirCurso;
    window.abrirCurso = function (id) {
        window.cursoActual = (window.CURSOS || []).find(c => c.id === id);
        if (!window.cursoActual) return;
        if (!window.progreso[id]) window.progreso[id] = { leccionActual: 0, completado: false, cert: false };
        window.leccionActual = window.progreso[id].leccionActual || 0;
        window.renderLeccion();
        const modal = document.getElementById('lessonModal');
        if (modal) modal.classList.add('open');
    };

    /* Patch btnSiguienteLeccion para abrir certModal en la lección final */
    const sigBtn = document.getElementById('btnSiguienteLeccion');
    const oldListeners = sigBtn?.cloneNode(true);
    if (sigBtn) {

        sigBtn.parentNode.replaceChild(oldListeners, sigBtn);
        oldListeners.addEventListener('click', () => {
            if (!window.cursoActual) return;
            const lec = window.cursoActual.lecciones[window.leccionActual];
            if (!lec) return;

            if (lec.quiz && !lec.esFinal) {
                const sel = document.querySelector('input[name="quiz"]:checked');
                if (!sel) { mostrarToast('Selecciona una respuesta antes de continuar.', 'warning'); return; }
                const correcto = parseInt(sel.value) === lec.quiz.correcta;
                const res = document.getElementById('quizResultado');
                if (res) {
                    res.textContent = correcto ? '✅ ¡Correcto!' : '❌ Incorrecto. Revisa el contenido e intenta de nuevo.';
                    res.style.color = correcto ? 'var(--success,#22c55e)' : 'var(--danger,#ef4444)';
                }
                if (!correcto) return;
            }

            if (lec.esFinal) {
                /* Completar curso */
                window.progreso[window.cursoActual.id].completado = true;
                window.progreso[window.cursoActual.id].cert = true;
                window.guardarProgreso();
                /* Cerrar modal lección */
                document.getElementById('lessonModal')?.classList.remove('open');
                /* Abrir modal certificado */
                const certNombre = document.getElementById('certCursoNombre');
                if (certNombre) certNombre.textContent = window.cursoActual.titulo;
                document.getElementById('certModal')?.classList.add('open');

                if (typeof window.renderCursos === 'function') window.renderCursos(window.catActual || 'todos');
                if (typeof window.actualizarStats === 'function') window.actualizarStats();
                if (typeof window.renderCerts === 'function') window.renderCerts();
                mostrarToast(' ¡Curso completado! Certificado disponible.', 'success');
                /* Sync backend */
                if (typeof syncProgresoBackend === 'function') syncProgresoBackend(window.cursoActual.id, true);
                return;
            }

            window.leccionActual++;
            window.progreso[window.cursoActual.id].leccionActual = window.leccionActual;
            window.guardarProgreso();
            window.renderLeccion();
        });
    }

    /* Cerrar modal certificado */
    document.getElementById('closeCertModal')?.addEventListener('click', () => {
        document.getElementById('certModal')?.classList.remove('open');
    });

    /* Asegurar que lessonModal inicia oculto si no tiene clase CSS de oculto */
    const lessonModal = document.getElementById('lessonModal');
    if (lessonModal && !lessonModal.classList.contains('open')) {
        lessonModal.style.display = 'none'; // fallback visual
        lessonModal.classList.add('edu-hidden');
    }
    /* Cuando se agrega 'open', mostrar */
    const observer = new MutationObserver(() => {
        if (lessonModal.classList.contains('open')) {
            lessonModal.style.display = 'flex';
        } else {
            lessonModal.style.display = 'none';
        }
    });
    if (lessonModal) observer.observe(lessonModal, { attributes: true, attributeFilter: ['class'] });

    /* Mismo observer para certModal */
    const certModal = document.getElementById('certModal');
    if (certModal) {
        certModal.style.display = 'none';
        new MutationObserver(() => {
            certModal.style.display = certModal.classList.contains('open') ? 'flex' : 'none';
        }).observe(certModal, { attributes: true, attributeFilter: ['class'] });
    }
});


/* ─────────────────────────────────────────────────────────────────────────────
   ENCUESTAS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('encuestas')) return;

    /* Ocultar umbral por defecto */
    const umbralRow = document.getElementById('umbralRow');
    if (umbralRow) umbralRow.style.display = 'none';

    /* Patch btnConfirmarVoto para incluir Content-Type */
    const btnVoto = document.getElementById('btnConfirmarVoto');
    if (btnVoto) {
        /* Clonar para quitar listener original de encuestas.js */
        const clone = btnVoto.cloneNode(true);
        btnVoto.parentNode.replaceChild(clone, btnVoto);
        clone.addEventListener('click', async () => {
            const sel = document.querySelector('input[name="voteOpt"]:checked');
            if (!sel) { mostrarToast('Selecciona una opción para votar.', 'warning'); return; }
            const optionId = parseInt(sel.value);
            clone.disabled = true;
            clone.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
            try {
                await apiFetch(`/encuestas/${window.pollVotando?.id}/votar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ optionId })
                });
            } catch { /* fallback local manejado por encuestas.js original */ }
            /* Actualizar localmente siempre */
            if (window.pollVotando && window.misVotos) {
                window.misVotos[window.pollVotando.id] = optionId;
                localStorage.setItem('bkm_votos', JSON.stringify(window.misVotos));
                const opt = window.pollVotando.opciones?.find(o => o.id === optionId);
                if (opt) opt.votos++;
            }
            document.getElementById('voteModal')?.classList.remove('open');
            if (typeof window.renderPolls === 'function') window.renderPolls();
            if (typeof window.actualizarStats === 'function') window.actualizarStats();
            mostrarToast('✅ ¡Voto registrado exitosamente!', 'success');
            clone.disabled = false;
            clone.innerHTML = '<i class="fa-solid fa-check-to-slot"></i> Confirmar Voto';
        });
    }
});


/* ─────────────────────────────────────────────────────────────────────────────
   HISTORIAL
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('historial.html') &&
        !window.location.pathname.endsWith('/historial')) return;

    /* Alias filterTipo → filterType (compatibilidad con selects de otras páginas) */
    const filterTipo = document.getElementById('filterTipo');
    if (filterTipo && !document.getElementById('filterType')) {
        filterTipo.id = 'filterType';
    }

    const TIPOS_LABEL = {
        deposit: 'Depósito', withdrawal: 'Retiro', transfer: 'Transferencia',
        transfer_sent: 'Transf. enviada', transfer_received: 'Transf. recibida',
        loan_disbursement: 'Desembolso', loan_payment: 'Pago Préstamo', fee: 'Servicio'
    };
    const esIngreso = m => ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);

    /* Fechas por defecto: primer día del mes → hoy */
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const fi = document.getElementById('fechaInicio');
    const ff = document.getElementById('fechaFin');
    if (fi && !fi.value) fi.value = primerDiaMes;
    if (ff && !ff.value) ff.value = hoy.toISOString().split('T')[0];

    let _todasMovs = [];
    let _filtradas = [];
    let _paginaActual = 1;
    let _filasPorPagina = 10;

    function renderKpis(movs) {
        const ingresos = movs.filter(esIngreso).reduce((s, m) => s + parseFloat(m.monto || 0), 0);
        const egresos = movs.filter(m => !esIngreso(m)).reduce((s, m) => s + parseFloat(m.monto || 0), 0);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('kpiTotalMovs', movs.length);
        set('kpiTotalIngresos', formatearCOP(ingresos));
        set('kpiTotalEgresos', formatearCOP(egresos));
        set('kpiNetoPeriodo', formatearCOP(ingresos - egresos));
    }

    function renderPagina() {
        const tbody = document.getElementById('historialBody');
        if (!tbody) return;
        const inicio = (_paginaActual - 1) * _filasPorPagina;
        const pagina = _filtradas.slice(inicio, inicio + _filasPorPagina);
        const total = _filtradas.length;
        const totalPags = Math.max(1, Math.ceil(total / _filasPorPagina));

        const counter = document.getElementById('userCounter');
        if (counter) counter.textContent = total
            ? `${inicio + 1}–${Math.min(inicio + _filasPorPagina, total)} de ${total} movimientos`
            : 'Sin movimientos';

        const pageNums = document.getElementById('pageNumbers');
        if (pageNums) {
            pageNums.innerHTML = Array.from({ length: Math.min(totalPags, 5) }, (_, i) => {
                const p = i + 1;
                return `<button class="page-num ${p === _paginaActual ? 'active' : ''}"
                    data-action="ir-a-pagina" data-page="${p}">${p}</button>`;
            }).join('');
        }

        const prev = document.getElementById('prevPage');
        const next = document.getElementById('nextPage');
        if (prev) prev.disabled = _paginaActual === 1;
        if (next) next.disabled = _paginaActual >= totalPags;

        if (!pagina.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Sin movimientos en el período</td></tr>';
            return;
        }

        tbody.innerHTML = pagina.map(m => {
            const ing = esIngreso(m);
            const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';
            return `<tr class="${ing ? 'tx-ingreso' : 'tx-egreso'}">
                <td>${fechaTxt}</td>
                <td><strong>${TIPOS_LABEL[m.tipo] || m.tipo}</strong></td>
                <td>${m.descripcion || '-'}</td>
                <td style="font-family:var(--font-mono,monospace);font-size:.78rem">${m.referencia || '-'}</td>
                <td style="text-align:right" class="${ing ? 'text-ingreso' : 'text-egreso'}">${ing ? '+' : '-'}${formatearCOP(m.monto)}</td>
                <td style="text-align:right">
                    <button data-action="ver-comprobante"
                        data-referencia="${m.referencia || '-'}"
                        data-fecha="${m.fecha || ''}"
                        data-descripcion="${m.descripcion || (TIPOS_LABEL[m.tipo] || m.tipo)}"
                        data-monto="${m.monto || 0}"
                        data-tipo="${TIPOS_LABEL[m.tipo] || m.tipo}"
                        data-estado="${m.estado || 'completed'}"
                        class="btn-secondary" style="font-size:.73rem;padding:.28rem .55rem" title="Ver comprobante">
                        <i class="fa-solid fa-receipt"></i> Ver
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    function aplicarBusqueda() {
        const q = (document.getElementById('userInputSearch')?.value || '').toLowerCase();
        _filtradas = q
            ? _todasMovs.filter(m => `${m.descripcion || ''} ${m.referencia || ''} ${TIPOS_LABEL[m.tipo] || m.tipo}`.toLowerCase().includes(q))
            : _todasMovs.slice();
        _paginaActual = 1;
        renderPagina();
    }

    async function cargarHistorialPrincipal() {
        const tbody = document.getElementById('historialBody');
        if (tbody) mostrarCargandoTabla(tbody, 6);
        try {
            const fiv = document.getElementById('fechaInicio')?.value;
            const ffv = document.getElementById('fechaFin')?.value;
            const tipo = document.getElementById('filterType')?.value;
            let url = '/movimientos';
            const p = [];
            if (fiv) p.push(`inicio=${fiv}T00:00:00`);
            if (ffv) p.push(`fin=${ffv}T23:59:59`);
            if (tipo && tipo !== 'todos' && tipo !== '') p.push(`tipo=${tipo}`);
            if (p.length) url += '?' + p.join('&');
            const res = await apiFetch(url);
            if (!res?.ok) throw new Error();
            _todasMovs = await res.json();
            renderKpis(_todasMovs);
            aplicarBusqueda();
        } catch {
            if (tbody) mostrarErrorTabla(tbody, 'Error al cargar movimientos', 6);
        }
    }
    /* Exponer con el mismo nombre histórico por si otro script aún lo invoca */
    window.cargarHistorialAnalisis = cargarHistorialPrincipal;

    cargarHistorialPrincipal();

    document.getElementById('btnFiltrar')?.addEventListener('click', cargarHistorialPrincipal);
    document.getElementById('userInputSearch')?.addEventListener('input', aplicarBusqueda);

    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (_paginaActual > 1) { _paginaActual--; renderPagina(); }
    });
    document.getElementById('nextPage')?.addEventListener('click', () => {
        _paginaActual++; renderPagina();
    });
    document.getElementById('rowsPerPage')?.addEventListener('change', e => {
        _filasPorPagina = parseInt(e.target.value) || 10;
        _paginaActual = 1;
        renderPagina();
    });
    document.getElementById('pageNumbers')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="ir-a-pagina"]');
        if (!btn) return;
        _paginaActual = Number(btn.dataset.page); renderPagina();
    });

});


/* ─────────────────────────────────────────────────────────────────────────────
   HISTORIAL-ANALISIS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('historial-analisis')) return;

    /* Filtros disparan recarga automática */
    document.getElementById('filterPeriod')?.addEventListener('change', cargarAnalisisConGraficos);
    document.getElementById('filterType')?.addEventListener('change', cargarAnalisisConGraficos);

    /* Reemplazar el listener de btnFiltrarReporte para usar la versión con gráficos */
    const btn = document.getElementById('btnFiltrarReporte');
    if (btn) {
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
        clone.addEventListener('click', cargarAnalisisConGraficos);
    }

    cargarAnalisisConGraficos();
});

let _lineChart = null, _pieChart = null;

async function cargarAnalisisConGraficos() {
    /* Ejecutar la carga base (tabla + KPIs) */
    if (typeof cargarHistorialAnalisis === 'function') await cargarHistorialAnalisis();

    /* Ahora dibujar los gráficos */
    if (typeof Chart === 'undefined') return;

    const periodo = document.getElementById('filterPeriod')?.value || '90';
    const tipo = document.getElementById('filterType')?.value || 'todos';
    const hoy = new Date();
    let desde;
    if (periodo === '2026') { desde = new Date('2026-01-01'); }
    else { desde = new Date(hoy); desde.setDate(desde.getDate() - parseInt(periodo)); }

    try {
        let url = '/movimientos';
        const p = [`inicio=${desde.toISOString().split('T')[0]}T00:00:00`,
        `fin=${hoy.toISOString().split('T')[0]}T23:59:59`];
        if (tipo && tipo !== 'todos') p.push(`tipo=${tipo}`);
        url += '?' + p.join('&');

        const res = await apiFetch(url);
        if (!res?.ok) return;
        const movs = await res.json();

        /* ── Gráfico línea: Ingresos vs Egresos por semana ── */
        const ctxLine = document.getElementById('lineChart');
        if (ctxLine) {
            /* Agrupar por semana */
            const semanas = {};
            movs.forEach(m => {
                if (!m.fecha) return;
                const d = new Date(m.fecha);
                const sem = Math.floor((d - desde) / (7 * 86400000));
                const key = `S${sem + 1}`;
                if (!semanas[key]) semanas[key] = { ing: 0, egr: 0 };
                const esIng = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
                if (esIng) semanas[key].ing += parseFloat(m.monto || 0);
                else semanas[key].egr += parseFloat(m.monto || 0);
            });
            const labels = Object.keys(semanas);
            const ings = labels.map(k => semanas[k].ing);
            const egrs = labels.map(k => semanas[k].egr);

            if (_lineChart) _lineChart.destroy();
            _lineChart = new Chart(ctxLine.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels.length ? labels : ['Sin datos'],
                    datasets: [
                        { label: 'Ingresos', data: ings, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.1)', fill: true, tension: 0.4 },
                        { label: 'Egresos', data: egrs, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'k' }
                        }
                    }
                }
            });
        }

        /* ── Gráfico pie: Distribución por tipo ── */
        const ctxPie = document.getElementById('pieChart');
        if (ctxPie) {
            const cats = {};
            const labels_tipo = {
                deposit: 'Depósitos', withdrawal: 'Retiros',
                transfer: 'Transf. enviadas', transfer_received: 'Transf. recibidas',
                loan_payment: 'Pagos préstamo', fee: 'Servicios', loan_disbursement: 'Desembolsos'
            };
            movs.forEach(m => {
                const cat = labels_tipo[m.tipo] || m.tipo || 'Otro';
                cats[cat] = (cats[cat] || 0) + Math.abs(parseFloat(m.monto || 0));
            });

            if (_pieChart) _pieChart.destroy();
            const pieLabels = Object.keys(cats);
            _pieChart = new Chart(ctxPie.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: pieLabels.length ? pieLabels : ['Sin datos'],
                    datasets: [{
                        data: pieLabels.length ? Object.values(cats) : [1],
                        backgroundColor: ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
                }
            });
        }
    } catch { /* silencioso */ }
}


/* ─────────────────────────────────────────────────────────────────────────────
   NOTIFICACIONES
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('notificaciones')) return;

    /* Crear alias del elemento para que notificaciones.js lo encuentre */
    const listaReal = document.getElementById('notificacionesList');
    if (listaReal && !document.getElementById('listaNotificaciones')) {
        listaReal.id = 'listaNotificaciones'; // renombrar para compatibilidad con JS
    }

    /* btnMarcarTodasLeidas → alias btnMarcarTodas */
    const btnTodas = document.getElementById('btnMarcarTodasLeidas');
    if (btnTodas && !document.getElementById('btnMarcarTodas')) {
        btnTodas.id = 'btnMarcarTodas';
    }

    /* Filtros de categoría */
    let filtroActivo = 'todas';
    let _notifData = [];

    document.querySelectorAll('.ntf-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.ntf-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            filtroActivo = pill.dataset.filter || 'todas';
            aplicarFiltroNotif();
        });
    });

    document.getElementById('buscarNotif')?.addEventListener('input', aplicarFiltroNotif);

    function aplicarFiltroNotif() {
        const q = (document.getElementById('buscarNotif')?.value || '').toLowerCase();
        document.querySelectorAll('#listaNotificaciones .notif-item').forEach(el => {
            const texto = el.textContent.toLowerCase();
            const tipo = el.dataset.tipo || '';
            const filtOk = filtroActivo === 'todas' || tipo.includes(filtroActivo) ||
                texto.includes(filtroActivo);
            const buscOk = !q || texto.includes(q);
            el.style.display = filtOk && buscOk ? '' : 'none';
        });
    }

    /* Calcular KPIs después de cargar — esperar al DOM */
    const observer = new MutationObserver(() => {
        const items = document.querySelectorAll('#listaNotificaciones .notif-item');
        const noLeidas = document.querySelectorAll('#listaNotificaciones .notif-item.no-leida').length;
        const leidas = document.querySelectorAll('#listaNotificaciones .notif-item.leida').length;
        const alertas = [...items].filter(el =>
            el.textContent.toLowerCase().includes('urgente') ||
            el.textContent.toLowerCase().includes('alerta') ||
            el.textContent.toLowerCase().includes('bloqueado') ||
            el.textContent.toLowerCase().includes('vencido')).length;
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        set('kpiTotalNotif', items.length);
        set('kpiNoLeidas', noLeidas);
        set('kpiLeidas', leidas);
        set('kpiAlertas', alertas);
        /* Marcar tipo en dataset para filtros */
        items.forEach(el => {
            const txt = el.textContent.toLowerCase();
            if (txt.includes('pago') || txt.includes('cuota')) el.dataset.tipo = 'pagos';
            else if (txt.includes('préstamo') || txt.includes('credito')) el.dataset.tipo = 'prestamos';
            else if (txt.includes('seguridad') || txt.includes('acceso')) el.dataset.tipo = 'seguridad';
            else el.dataset.tipo = 'sistema';
        });
    });
    const lista = document.getElementById('listaNotificaciones');
    if (lista) observer.observe(lista, { childList: true, subtree: true });
});


/* ─────────────────────────────────────────────────────────────────────────────
   PAGOS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('pagos')) return;

    /* Llenar cuentaPago después de que initPaginaPagos haya corrido */
    setTimeout(async () => {
        const selCuenta = document.getElementById('cuentaPago');
        if (!selCuenta || selCuenta.options.length > 1) return; // ya fue llenado
        try {
            const res = await apiFetch('/cuentas');
            if (!res?.ok) throw new Error();
            const cuentas = await res.json();
            window._cuentasUsuario = cuentas;
            selCuenta.innerHTML = '<option value="">Selecciona cuenta</option>' +
                cuentas.map(c =>
                    `<option value="${c.numero}">${c.tipo || 'Cuenta'} · ****${(c.numero || '').slice(-4)} (${formatearCOP(c.saldo)})</option>`
                ).join('');
        } catch {
            selCuenta.innerHTML = '<option value="">Sin cuentas disponibles</option>';
        }
    }, 600);

    /* money-mask para montoPago */
    document.getElementById('montoPago')?.addEventListener('input', function () {
        const raw = this.value.replace(/\D/g, '');
        const num = parseInt(raw) || 0;
        this.value = num > 0 ? num.toLocaleString('es-CO') : '';
    });
});


/* =============================================================================
   configuracion, cuentas, dashboard, detalle-prestamos, documentos
   ============================================================================= */

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIGURACION
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('configuracion')) return;

    const s = getSession?.() || {};

    /* Llenar KPIs sesiones y 2FA */
    (async () => {
        try {
            const [resCfg, resAud] = await Promise.allSettled([
                apiFetch('/usuarios/configuracion'),
                apiFetch('/admin/auditoria?tipo=LOGIN_SUCCESS')
            ]);
            const cfg = resCfg.status === 'fulfilled' && resCfg.value?.ok
                ? await resCfg.value.json() : {};
            const aud = resAud.status === 'fulfilled' && resAud.value?.ok
                ? await resAud.value.json() : [];

            const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
            const sesiones = aud.filter(l => {
                const d = l.createdAt ? new Date(l.createdAt) : null;
                return d && (Date.now() - d) < 86400000 * 7;
            }).length;
            setEl('kpiSesiones', sesiones || 1);
            setEl('kpi2FA', cfg.twoFaEnabled ? '✓ Activo' : '✗ Inactivo');

            /* Restaurar preferencias guardadas */
            if (cfg.idioma) {
                const idiomaEl = document.getElementById('config-idioma');
                if (idiomaEl) idiomaEl.value = cfg.idioma;
            }
            if (cfg.moneda) {
                const monedaEl = document.getElementById('config-moneda');
                if (monedaEl) monedaEl.value = cfg.moneda;
            }
            /* Sincronizar toggles de notificaciones */
            ['notifEmail', 'notifSMS', 'notifApp', 'notifPagos', 'notifAlertas'].forEach(key => {
                const el = document.getElementById('toggle' + key.charAt(0).toUpperCase() + key.slice(1))
                    || document.getElementById(key);
                if (el && cfg[key] !== undefined) el.checked = cfg[key];
            });
        } catch { /* silencioso */ }
    })();

    /* Guardar preferencias */
    document.getElementById('btnGuardarPrefs')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';

        const prefs = {
            idioma: document.getElementById('config-idioma')?.value || 'es',
            moneda: document.getElementById('config-moneda')?.value || 'COP',
            notifEmail: document.getElementById('toggleNotifEmail')?.checked ?? true,
            notifSMS: document.getElementById('toggleNotifSMS')?.checked ?? false,
            notifApp: document.getElementById('toggleNotifApp')?.checked ?? true,
            notifPagos: document.getElementById('toggleNotifPagos')?.checked ?? true,
            notifAlertas: document.getElementById('toggleNotifAlertas')?.checked ?? true,
        };

        try {
            const res = await apiFetch('/usuarios/configuracion', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs)
            });
            if (res?.ok) {
                mostrarToast('✅ Preferencias guardadas correctamente', 'success');
            } else {
                mostrarToast('No se pudieron guardar las preferencias', 'error');
            }
        } catch {
            mostrarToast('Error al conectar con el servidor', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Preferencias';
        }
    });

    (function syncThemeBtn2() {
        const btn2 = document.getElementById('themeBtn2');
        const icon2 = document.querySelector('#themeBtn2 i');
        const isDark = document.body.classList.contains('dark-mode');
        if (icon2) {
            icon2.className = isDark ? 'fa-solid fa-sun u-6c660c' : 'fa-solid fa-moon u-6c660c';
        }
        btn2?.addEventListener('click', () => {
            const dark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', dark ? 'enabled' : 'disabled');
            const ic = document.querySelector('#themeBtn2 i');
            if (ic) ic.className = dark ? 'fa-solid fa-sun u-6c660c' : 'fa-solid fa-moon u-6c660c';
            /* Sincronizar también el botón del header */
            const ic1 = document.querySelector('#themeBtn i');
            if (ic1) ic1.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            mostrarToast(dark ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado', 'info');
        });
    })();

    /* toggles de notificaciones → guardar al cambiar (optimistic) */
    ['toggleNotifEmail', 'toggleNotifSMS', 'toggleNotifApp', 'toggleNotifPagos', 'toggleNotifAlertas'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            /* Feedback inmediato; el guardado definitivo se hace con btnGuardarPrefs */
            mostrarToast('Preferencia actualizada (guarda para confirmar)', 'info');
        });
    });
});


/* ─────────────────────────────────────────────────────────────────────────────
   CUENTAS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('cuentas')) return;

    /* Filtros de tipo en historial de la cuenta */
    ['filterTodos', 'filterIngresos', 'filterEgresos'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function () {
            ['filterTodos', 'filterIngresos', 'filterEgresos'].forEach(bid => {
                document.getElementById(bid)?.classList.remove('active');
            });
            this.classList.add('active');
            const tipo = id === 'filterTodos' ? 'todos' : id === 'filterIngresos' ? 'ingreso' : 'egreso';
            document.querySelectorAll('#movimientosBody tr, #txBody tr').forEach(tr => {
                const cls = tr.className;
                if (tipo === 'todos') { tr.style.display = ''; return; }
                const esIng = cls.includes('tx-ingreso') || cls.includes('ingreso');
                const esEgr = cls.includes('tx-egreso') || cls.includes('egreso');
                if (tipo === 'ingreso') tr.style.display = esIng ? '' : 'none';
                else tr.style.display = esEgr ? '' : 'none';
            });
        });
    });

    /* btnRecibir → copiar número de cuenta al portapapeles */
    document.getElementById('btnRecibir')?.addEventListener('click', async () => {
        const s = getSession?.() || {};
        const numeroCuenta = s.cuenta || s.numeroCuenta || '';
        if (!numeroCuenta) { mostrarToast('Número de cuenta no disponible', 'warning'); return; }
        try {
            await navigator.clipboard.writeText(numeroCuenta);
            mostrarToast(`📋 Número ${numeroCuenta} copiado al portapapeles`, 'success');
        } catch {
            prompt('Copia tu número de cuenta:', numeroCuenta);
        }
    });

    /* btnCompartirCuenta → Web Share API o clipboard */
    document.getElementById('btnCompartirCuenta')?.addEventListener('click', async () => {
        const s = getSession?.() || {};
        const texto = `Mi número de cuenta Bankomunal: ${s.cuenta || s.numeroCuenta || '—'}`;
        if (navigator.share) {
            try { await navigator.share({ title: 'Mi cuenta Bankomunal', text: texto }); return; }
            catch { /* fallback */ }
        }
        try { await navigator.clipboard.writeText(texto); mostrarToast('📋 Información copiada', 'success'); }
        catch { prompt('Comparte tu cuenta:', texto); }
    });

    /* Botones de acción rápida de cuenta (.mf-btn) */
    document.querySelectorAll('.mf-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const rutas = {
                transferencia: 'transferencias.html',
                pago: 'pagos.html',
                recarga: 'cuentas.html',
                historial: 'historial.html'
            };
            if (rutas[action]) window.location.href = rutas[action];
        });
    });

    /* Modal nueva cuenta */
    const modalNueva = document.getElementById('modalNuevaCuenta');
    const cerrarNueva = () => {
        if (modalNueva) { modalNueva.classList.add('hidden'); modalNueva.style.display = 'none'; }
    };
    document.getElementById('btnAbrirNuevaCuenta')?.addEventListener('click', () => {
        if (modalNueva) { modalNueva.classList.remove('hidden'); modalNueva.style.display = 'flex'; }
    });
    document.getElementById('btnCerrarNuevaCuenta')?.addEventListener('click', cerrarNueva);
    document.getElementById('btnCancelarNuevaCuenta')?.addEventListener('click', cerrarNueva);
    modalNueva?.addEventListener('click', e => { if (e.target === modalNueva) cerrarNueva(); });

    document.getElementById('formNuevaCuenta')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tipoCuenta = document.getElementById('tipoCuenta')?.value;
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...'; }
        try {
            const res = await apiFetch('/cuentas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo: tipoCuenta })
            });
            if (res?.ok) {
                mostrarToast('✅ Cuenta creada correctamente', 'success');
                cerrarNueva();
                setTimeout(() => location.reload(), 1200);
            } else {
                mostrarToast('No se pudo crear la cuenta. Intenta de nuevo.', 'error');
            }
        } catch { mostrarToast('Error al conectar con el servidor', 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Crear Cuenta'; } }
    });
});


/* ─────────────────────────────────────────────────────────────────────────────
   DASHBOARD
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('dashboard')) return;

    /* Filtro tipo movimiento en tabla del dashboard */
    document.getElementById('filterTypeDash')?.addEventListener('change', function () {
        const tipo = this.value;
        document.querySelectorAll('#txBody tr').forEach(tr => {
            if (!tipo || tipo === 'todos') { tr.style.display = ''; return; }
            const esIng = tr.classList.contains('tx-ingreso');
            const esEgr = tr.classList.contains('tx-egreso');
            if (tipo === 'ingreso' || tipo === 'deposit' || tipo === 'credit') {
                tr.style.display = esIng ? '' : 'none';
            } else {
                tr.style.display = esEgr ? '' : 'none';
            }
        });
    });

    /* btnWhatsapp → soporte por WhatsApp */
    document.getElementById('btnWhatsapp')?.addEventListener('click', () => {
        const s = getSession?.() || {};
        const msg = encodeURIComponent(
            `Hola, soy ${s.nombre || 'un socio'} de Bankomunal (${s.email || ''}).` +
            ` Necesito soporte con mi cuenta.`
        );
        window.open(`https://wa.me/573001234567?text=${msg}`, '_blank');
    });
});


/* ─────────────────────────────────────────────────────────────────────────────
   DETALLE-PRESTAMOS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('detalle-prestamos')) return;

    /* Alias amorBody → amortizacionBody si el HTML usa el ID corto */
    const amorBody = document.getElementById('amorBody');
    if (amorBody && !document.getElementById('amortizacionBody')) {
        amorBody.id = 'amortizacionBody';
    }

    document.getElementById('btnDescargarCert')?.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const loanId = params.get('id') || '—';
        const s = getSession?.() || {};
        const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
        const folio = 'BKM-' + loanId + '-' + Date.now().toString().slice(-6);

        /* Leer valores visibles en la página para el cuerpo del certificado */
        const g = id => document.getElementById(id)?.textContent?.trim() || '—';
        const monto = g('kpiMonto');
        const saldo = g('pendingBalance');
        const cuota = g('kpiCuotaMensual');
        const plazo = g('kpiPlazo');
        const tasa = g('monthlyRate');
        const aprobacion = g('loanApprovalDate');
        const estado = g('loanStatus');
        const progreso = g('progressPercentage');
        const pagado = g('amountPaid');
        const proxVenc = g('nextDueDate');

        const tabla = document.getElementById('amortizacionBody')
            ?.closest('table')?.outerHTML || '';

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Certificado Bancario — Préstamo #${loanId}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11pt; background: #fff; }

  /* ── ENCABEZADO ── */
  .header { display: flex; justify-content: space-between; align-items: center;
            border-bottom: 3px solid #005F73; padding-bottom: 14px; margin-bottom: 20px; }
  .brand  { display: flex; align-items: center; gap: 12px; }
  .brand-icon { width: 48px; height: 48px; background: #005F73; border-radius: 10px;
                display: flex; align-items: center; justify-content: center; }
  .brand-icon svg { width: 28px; height: 28px; fill: #fff; }
  .brand-name   { font-size: 22pt; font-weight: 700; color: #004d5e; letter-spacing: -0.5px; }
  .brand-sub    { font-size: 8pt; color: #64748b; margin-top: 2px; }
  .header-right { text-align: right; }
  .cert-title   { font-size: 13pt; font-weight: 600; color: #004d5e; }
  .folio        { font-size: 8pt; color: #94a3b8; margin-top: 4px; }
  .fecha        { font-size: 9pt; color: #64748b; margin-top: 2px; }

  /* ── CUERPO ── */
  .section      { margin-bottom: 18px; }
  .section-title{ font-size: 9pt; font-weight: 700; text-transform: uppercase;
                  letter-spacing: .08em; color: #004d5e; border-bottom: 1px solid #e2e8f0;
                  padding-bottom: 5px; margin-bottom: 10px; }
  .grid-2       { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; }
  .grid-3       { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
  .field        { display: flex; flex-direction: column; }
  .field label  { font-size: 7.5pt; color: #64748b; text-transform: uppercase; letter-spacing:.04em; }
  .field span   { font-size: 10.5pt; font-weight: 600; color: #1e293b; margin-top: 1px; }
  .highlight    { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px; }
  .highlight .field span { color: #004d5e; font-size: 13pt; }

  /* ── TABLA AMORTIZACIÓN ── */
  .amort-section { margin-top: 22px; page-break-inside: auto; }
  table  { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead  { background: #004d5e; color: #fff; }
  th     { padding: 6px 8px; text-align: left; font-weight: 600; }
  td     { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:last-child td { border-bottom: 2px solid #004d5e; }

  /* ── PIE ── */
  .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px;
            display: flex; justify-content: space-between; align-items: flex-start; }
  .footer p { font-size: 7.5pt; color: #94a3b8; max-width: 55%; line-height: 1.4; }
  .firma    { text-align: center; }
  .firma-line { border-top: 1px solid #64748b; width: 160px; margin: 0 auto 4px; }
  .firma p  { font-size: 8pt; color: #475569; }
  .watermark{ position: fixed; bottom: 35mm; right: 18mm; font-size: 48pt; font-weight: 900;
              color: rgba(14,165,233,0.06); transform: rotate(-30deg); pointer-events: none;
              letter-spacing: -2px; }
 
  @media print {
    .no-print { display: none !important; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="watermark">BANKOMUNAL</div>

<!-- BOTÓN IMPRIMIR (solo pantalla) -->
<div class="no-print" style="text-align:right;padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;margin-bottom:20px;">
  <button onclick="window.print()" style="background:#005F73;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:10pt;cursor:pointer;font-weight:600;">
    ⬇ Guardar / Imprimir PDF
  </button>
</div>

<!-- ENCABEZADO -->
<div class="header">
  <div class="brand">
    <div class="brand-icon">
       <img src="../assets/img/logo.png" alt="Bankomunal" class="sidebar-logo" style="width:86px">
    </div>
    <div>
      <div class="brand-name">BANKOMUNAL</div>
      <div class="brand-sub">Cooperativa de Microfinanzas Comunitarias</div>
    </div>
  </div>
  <div class="header-right">
    <div class="cert-title">Certificado Bancario</div>
    <div class="folio">Folio: ${folio}</div>
    <div class="fecha">Fecha de emisión: ${hoy}</div>
  </div>
</div>

<!-- DATOS DEL TITULAR -->
<div class="section">
  <div class="section-title">Datos del Titular</div>
  <div class="grid-2">
    <div class="field"><label>Nombre completo</label><span>${s.nombre || '—'}</span></div>
    <div class="field"><label>Correo electrónico</label><span>${s.email || '—'}</span></div>
    <div class="field"><label>N.° de cuenta</label><span>${s.cuenta || '—'}</span></div>
    <div class="field"><label>Rol</label><span>${s.rol || 'Socio'}</span></div>
  </div>
</div>

<!-- RESUMEN DEL CRÉDITO -->
<div class="section">
  <div class="section-title">Resumen del Crédito — Préstamo #${loanId}</div>
  <div class="grid-3" style="margin-bottom:12px;">
    <div class="field highlight">
      <label>Monto original</label><span>${monto}</span>
    </div>
    <div class="field highlight">
      <label>Saldo pendiente</label><span style="color:#dc2626">${saldo}</span>
    </div>
    <div class="field highlight">
      <label>Cuota mensual</label><span>${cuota}</span>
    </div>
  </div>
  <div class="grid-3">
    <div class="field"><label>Plazo</label><span>${plazo}</span></div>
    <div class="field"><label>Tasa mensual</label><span>${tasa}</span></div>
    <div class="field"><label>Estado</label><span>${estado}</span></div>
    <div class="field"><label>Fecha aprobación</label><span>${aprobacion}</span></div>
    <div class="field"><label>Progreso de pago</label><span>${progreso}</span></div>
    <div class="field"><label>Total pagado</label><span>${pagado}</span></div>
  </div>
  ${proxVenc !== '—' ? `<div style="margin-top:10px;" class="field"><label>Próximo vencimiento</label><span style="color:#d97706">${proxVenc}</span></div>` : ''}
</div>

<!-- TABLA AMORTIZACIÓN -->
${tabla ? `<div class="amort-section">
  <div class="section-title">Tabla de Amortización</div>
  ${tabla}
</div>` : ''}

<!-- PIE DE PÁGINA -->
<div class="footer">
  <p>Este documento es un comprobante informativo generado electrónicamente por el sistema Bankomunal. No requiere firma física. Válido como certificado de existencia y condiciones del crédito a la fecha de emisión.</p>
  <div class="firma">
    <div class="firma-line"></div>
    <p><strong>Bankomunal</strong></p>
    <p>Sistema de Microfinanzas</p>
    <p style="color:#94a3b8;font-size:7pt;">NIT: 900.XXX.XXX-X</p>
  </div>
</div>

</body>
</html>`;

        const printWin = window.open('', '_blank');
        if (!printWin) {
            mostrarToast('Permite ventanas emergentes para generar el certificado.', 'warning');
            return;
        }
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
    });
});


/* ─────────────────────────────────────────────────────────────────────────────
   DOCUMENTOS
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('documentos')) return;

    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            /* Exponer la categoría activa como variable global para que
               renderDocs() de documentos.js la lea */
            window._catDocActiva = this.dataset.cat || 'todas';

            if (typeof window.renderDocs === 'function') {
                window.renderDocs();
            } else {
                /* Fallback: filtrar los doc-items ya renderizados en el DOM */
                document.querySelectorAll('.doc-item, .doc-card').forEach(el => {
                    const cat = el.dataset.cat || el.dataset.categoria || '';
                    el.style.display =
                        (window._catDocActiva === 'todas' || cat === window._catDocActiva)
                            ? '' : 'none';
                });
            }
        });
    });

    /* Patch renderDocs para que respete la categoría activa */
    if (typeof window.renderDocs === 'function') {
        const _renderDocsOrig = window.renderDocs;
        window.renderDocs = function () {
            _renderDocsOrig();
            const catActiva = window._catDocActiva || 'todas';
            if (catActiva === 'todas') return;
            setTimeout(() => {
                document.querySelectorAll('.doc-item, .doc-card').forEach(el => {
                    const cat = el.dataset.cat || el.dataset.categoria || '';
                    el.style.display = cat === catActiva ? '' : 'none';
                });
            }, 50); // dar tiempo al renderizado
        };
    }
});


/* =============================================================================
   auditoria, ayuda, beneficios, chat-soporte, comunidad
   ============================================================================= */

/* ─────────────────────────────────────────────────────────────────────────────
   AUDITORIA
   ─────────────────────────────────────────────────────────────────────────── */
async function cargarLogAuditoria() {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const tbody = document.getElementById('auditLogBody');
    if (tbody) mostrarCargandoTabla(tbody, 6);

    const filtroTipo = document.getElementById('filtroTipo')?.value || '';
    const fechaInicio = document.getElementById('fechaInicioAudit')?.value || '';
    const fechaFin = document.getElementById('fechaFinAudit')?.value || '';

    const params = [];
    if (filtroTipo) params.push(`tipo=${encodeURIComponent(filtroTipo)}`);
    if (fechaInicio) params.push(`inicio=${fechaInicio}T00:00:00`);
    if (fechaFin) params.push(`fin=${fechaFin}T23:59:59`);
    const url = '/admin/auditoria' + (params.length ? '?' + params.join('&') : '');

    try {
        const res = await apiFetch(url);
        if (!res?.ok) throw new Error('HTTP ' + res?.status);
        const logs = await res.json();

        /* KPIs */
        const hoyStr = new Date().toISOString().split('T')[0];
        const hoy = logs.filter(l => (l.createdAt || l.fecha || '').startsWith(hoyStr));
        const exitosos = logs.filter(l =>
            l.eventType === 'LOGIN_SUCCESS' || l.resultado === 'EXITOSO' || l.resultado === 'OK');
        const fallidos = logs.filter(l =>
            l.eventType === 'LOGIN_FAILED' || l.resultado === 'FALLIDO' || l.resultado === 'ERROR');
        const alertas = logs.filter(l =>
            l.eventType === 'BLOCKED' || l.eventType === 'UNAUTHORIZED' ||
            l.nivel === 'CRITICO' || l.nivel === 'ALERTA');

        set('countEventos', hoy.length);
        set('countAlertas', alertas.length);
        set('countExitosos', exitosos.length);
        set('countFallidos', fallidos.length);

        /* Tabla */
        if (tbody) {
            if (!logs.length) {
                mostrarVacioTabla(tbody, 'Sin eventos de auditoría para los filtros seleccionados', 6);
            } else {
                const nivelBadge = nivel => {
                    const cls = nivel === 'CRITICO' || nivel === 'ALERTA'
                        ? 'status-danger' : nivel === 'INFO' ? 'status-info' : 'status-neutral';
                    return `<span class="status-badge ${cls}">${nivel || 'INFO'}</span>`;
                };
                tbody.innerHTML = logs.slice(0, 200).map(l => {
                    const fecha = l.createdAt || l.fecha
                        ? new Date(l.createdAt || l.fecha).toLocaleString('es-CO') : '—';
                    const tipo = l.eventType || l.tipo || '—';
                    const usuario = l.userEmail || l.usuario || l.email || '—';
                    const ip = l.ipAddress || l.ip || '—';
                    const nivel = l.nivel || (exitosos.includes(l) ? 'INFO' : fallidos.includes(l) ? 'ALERTA' : 'INFO');
                    const desc = l.descripcion || l.details || l.message || '—';
                    return `<tr>
                        <td style="font-size:.78rem;white-space:nowrap">${fecha}</td>
                        <td><code style="font-size:.75rem">${tipo}</code></td>
                        <td style="font-size:.8rem">${usuario}</td>
                        <td style="font-size:.78rem">${ip}</td>
                        <td>${nivelBadge(nivel)}</td>
                        <td style="font-size:.78rem;color:var(--text-muted)">${desc}</td>
                    </tr>`;
                }).join('');
            }
        }

        /* Dibujar gráfico de barras si existe canvas #auditChart */
        const ctx = document.getElementById('auditChart');
        if (ctx && typeof Chart !== 'undefined') {
            const byHour = new Array(24).fill(0);
            logs.forEach(l => {
                const ts = l.createdAt || l.fecha;
                if (ts) byHour[new Date(ts).getHours()]++;
            });
            if (window._auditChart) window._auditChart.destroy();
            window._auditChart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
                    datasets: [{
                        label: 'Eventos por hora', data: byHour,
                        backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });
        }
    } catch (err) {
        if (tbody) mostrarVacioTabla(tbody, 'No se pudo cargar el log de auditoría. Verifica permisos.', 6);
        set('countEventos', '—'); set('countAlertas', '—');
        set('countExitosos', '—'); set('countFallidos', '—');
    }
}


/* ─────────────────────────────────────────────────────────────────────────────
   AYUDA
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('ayuda')) return;

    /* BUG-2: Filtros de categoría FAQ */
    document.querySelectorAll('.fcat-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const cat = this.dataset.cat || 'todas';
            document.querySelectorAll('.faq-item[data-cat]').forEach(item => {
                item.style.display = (cat === 'todas' || item.dataset.cat === cat) ? '' : 'none';
            });
        });
    });

    /* Búsqueda en FAQ */
    document.getElementById('faqSearch')?.addEventListener('input', function () {
        const q = this.value.toLowerCase().trim();
        document.querySelectorAll('.faq-item').forEach(item => {
            const texto = item.textContent.toLowerCase();
            item.style.display = (!q || texto.includes(q)) ? '' : 'none';
        });
        /* Desactivar filtro activo si hay búsqueda */
        if (q) {
            document.querySelectorAll('.fcat-btn').forEach(b => b.classList.remove('active'));
        }
    });

    /* Modal de Términos y Condiciones */
    const termsModal = document.getElementById('termsModal');
    const abrirTerms = () => {
        if (termsModal) { termsModal.classList.remove('hidden'); termsModal.style.display = 'flex'; }
    };
    const cerrarTerms = () => {
        if (termsModal) { termsModal.classList.add('hidden'); termsModal.style.display = 'none'; }
    };
    document.getElementById('openTerms')?.addEventListener('click', e => { e.preventDefault(); abrirTerms(); });
    document.getElementById('closeTerms')?.addEventListener('click', cerrarTerms);
    document.getElementById('acceptTerms')?.addEventListener('click', cerrarTerms);
    termsModal?.addEventListener('click', e => { if (e.target === termsModal) cerrarTerms(); });
});

/* ─────────────────────────────────────────────────────────────────────────────
   CHAT-SOPORTE
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('chat-soporte')) return;

    /* Cargar nombre y estado del agente desde config */
    (async () => {
        try {
            const res = await apiFetch('/config/soporte');
            if (!res?.ok) throw new Error();
            const cfg = await res.json();
            const nameEl = document.getElementById('agentNameDisplay');
            const statusEl = document.getElementById('agentStatusText');
            if (nameEl && cfg.nombreAgente) nameEl.textContent = cfg.nombreAgente;
            if (statusEl && cfg.disponible != null) {
                statusEl.innerHTML = cfg.disponible
                    ? '<i class="fa-solid fa-circle" style="color:#22c55e"></i> En línea ahora'
                    : '<i class="fa-solid fa-circle" style="color:#94a3b8"></i> Fuera de línea';
            }
        } catch {
            /* Fallback ya está en el HTML: "Asistente Bankomunal / En línea ahora" */
        }
    })();
});


/* ─────────────────────────────────────────────────────────────────────────────
   COMUNIDAD
   ─────────────────────────────────────────────────────────────────────────── */
async function cargarGruposComunidad() {
    const lista = document.getElementById('listaGrupos');
    if (!lista) return;
    lista.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando grupos...</div>';

    try {
        const res = await apiFetch('/comunidad/grupos');
        if (!res?.ok) throw new Error('no grupos');
        const grupos = await res.json();

        if (!grupos.length) {
            lista.innerHTML = '<p style="padding:1.2rem;color:var(--text-muted);font-size:.85rem;text-align:center">No perteneces a ningún grupo aún. ¡Crea uno!</p>';
            return;
        }

        lista.innerHTML = grupos.map(g => `
            <div data-grupo-id="${g.id}" style="border:1px solid var(--border);border-radius:10px;padding:1rem 1.1rem;margin-bottom:.7rem;background:var(--bg-card)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:700;font-size:.92rem;color:var(--text-primary)">${g.nombre || 'Grupo'}</div>
                        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.15rem">
                            ${g.totalMiembros || 1} miembro(s) · Tu rol: <strong>${g.miRol || 'miembro'}</strong>
                        </div>
                        <div style="font-size:.78rem;color:var(--text-muted)">
                            Fondo común: <strong style="color:var(--primary)">${formatearCOP(g.fondoComun || 0)}</strong>
                        </div>
                    </div>
                    <div style="display:flex;gap:.45rem;flex-shrink:0;align-items:center">
                        <button data-action="verMiembrosGrupo" data-grupo-id="${g.id}" data-grupo-nombre="${(g.nombre || '').replace(/"/g, '&quot;')}"
                            class="btn-secondary" style="font-size:.75rem;padding:.32rem .65rem">
                            <i class="fa-solid fa-users"></i> Miembros
                        </button>
                        <button data-action="chat-grupo" data-grupo-id="${g.id}" data-grupo-nombre="${(g.nombre || '').replace(/"/g, '&quot;')}"
                            class="btn-secondary" style="font-size:.75rem;padding:.32rem .65rem">
                            <i class="fa-solid fa-people-group"></i> Chat
                        </button>
                        <button class="btn-secondary btn-aportar-fondo" data-grupo-id="${g.id}" data-grupo-nombre="${(g.nombre || '').replace(/"/g, '&quot;')}"
                            style="font-size:.75rem;padding:.32rem .65rem">
                            <i class="fa-solid fa-piggy-bank"></i> Aportar
                        </button>
                        <button data-action="agregarMiembro" data-grupo-id="${g.id}"
                            class="btn-secondary" style="font-size:.75rem;padding:.32rem .65rem">
                            <i class="fa-solid fa-user-plus"></i> Agregar
                        </button>
                    </div>
                </div>
                ${g.descripcion ? `<p style="font-size:.78rem;color:var(--text-muted);margin:.5rem 0 0">${g.descripcion}</p>` : ''}
            </div>
        `).join('');

        // Wiring botones Aportar
        lista.querySelectorAll('.btn-aportar-fondo').forEach(btn => {
            btn.addEventListener('click', () => {
                abrirModalAportarFondo(btn.dataset.grupoId, btn.dataset.grupoNombre);
            });
        });

    } catch {
        lista.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:.83rem;text-align:center">No se pudieron cargar los grupos.</p>';
    }
}

/** Abre el modal de aportar al fondo común */
function abrirModalAportarFondo(grupoId, grupoNombre) {
    // Crear modal dinámico si no existe
    let modal = document.getElementById('modalAportarFondo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalAportarFondo';
        modal.className = 'modal-overlay hidden';
        modal.style.cssText = 'z-index:9999';
        modal.innerHTML = `
            <div class="modal-card" style="max-width:380px;width:92%">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary)">
                        <i class="fa-solid fa-piggy-bank" style="color:var(--primary)"></i> Aportar al Fondo Común
                    </h3>
                    <button id="closeMAF" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);line-height:1">&times;</button>
                </div>
                <p id="mafGrupoNombre" style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem"></p>
                <div style="margin-bottom:1rem">
                    <label style="font-size:.82rem;color:var(--text-muted);display:block;margin-bottom:.35rem">Monto a aportar ($)</label>
                    <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-card)">
                        <span style="padding:0 .7rem;color:var(--text-muted);font-size:.9rem">$</span>
                        <input id="mafMonto" type="text" inputmode="numeric" placeholder="50.000"
                            style="flex:1;border:none;outline:none;padding:.55rem .4rem .55rem 0;background:transparent;font-size:.9rem;color:var(--text-primary)">
                    </div>
                </div>
                <div style="display:flex;gap:.7rem">
                    <button id="btnCancelarMAF" class="btn-secondary" style="flex:1">Cancelar</button>
                    <button id="btnConfirmarMAF" class="btn-primary" style="flex:2">
                        <i class="fa-solid fa-check"></i> Aportar
                    </button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Money mask en monto
        document.getElementById('mafMonto')?.addEventListener('input', function () {
            const raw = this.value.replace(/\D/g, '');
            this.value = raw ? parseInt(raw).toLocaleString('es-CO') : '';
        });

        const cerrarMAF = () => { modal.classList.add('hidden'); modal.classList.remove('active'); };
        document.getElementById('closeMAF')?.addEventListener('click', cerrarMAF);
        document.getElementById('btnCancelarMAF')?.addEventListener('click', cerrarMAF);
        modal.addEventListener('click', e => { if (e.target === modal) cerrarMAF(); });

        document.getElementById('btnConfirmarMAF')?.addEventListener('click', async () => {
            const gid = modal.dataset.grupoId;
            const raw = (document.getElementById('mafMonto')?.value || '').replace(/\D/g, '');
            const monto = parseInt(raw) || 0;
            if (!monto || monto < 1000) return mostrarToast('Monto mínimo $1.000', 'warning');

            const btn = document.getElementById('btnConfirmarMAF');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
            try {
                const res = await apiFetch(`/comunidad/grupos/${gid}/fondo`, {
                    method: 'POST',
                    body: JSON.stringify({ monto })
                });
                const data = await res?.json().catch(() => ({}));
                if (res?.ok) {
                    cerrarMAF();
                    mostrarToast(`✅ Aporte de ${formatearCOP(monto)} registrado al fondo común`, 'success');
                    cargarGruposComunidad(); // refrescar lista
                } else {
                    mostrarToast(data.mensaje || 'Error al aportar', 'error');
                }
            } catch { mostrarToast('Error de conexión', 'error'); }
            finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Aportar';
            }
        });
    }

    modal.dataset.grupoId = grupoId;
    const lbl = document.getElementById('mafGrupoNombre');
    if (lbl) lbl.textContent = `Grupo: ${grupoNombre || 'Grupo #' + grupoId}`;
    const inp = document.getElementById('mafMonto');
    if (inp) inp.value = '';
    modal.classList.remove('hidden');
    modal.classList.add('active');
}


function mostrarMiembrosGrupo(grupoId, grupoNombre) {
    let modal = document.getElementById('modalMiembrosGrupo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalMiembrosGrupo';
        modal.className = 'modal-overlay hidden';
        modal.style.cssText = 'z-index:9999';
        modal.innerHTML = `
            <div class="modal-card" style="max-width:420px;width:92%">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem">
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--text-primary)">
                        <i class="fa-solid fa-users" style="color:var(--primary)"></i> Integrantes del grupo
                    </h3>
                    <button id="closeMMG" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);line-height:1">&times;</button>
                </div>
                <p id="mmgGrupoNombre" style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem"></p>
                <div id="mmgLista" style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem"></div>
                <button id="btnCerrarMMG" class="btn-secondary" style="width:100%;margin-top:1.1rem">Cerrar</button>
            </div>`;
        document.body.appendChild(modal);

        const cerrarMMG = () => { modal.classList.add('hidden'); modal.classList.remove('active'); };
        document.getElementById('closeMMG')?.addEventListener('click', cerrarMMG);
        document.getElementById('btnCerrarMMG')?.addEventListener('click', cerrarMMG);
        modal.addEventListener('click', e => { if (e.target === modal) cerrarMMG(); });
    }

    const lblMMG = document.getElementById('mmgGrupoNombre');
    if (lblMMG) lblMMG.textContent = `Grupo: ${grupoNombre || 'Grupo #' + grupoId}`;

    const lista = document.getElementById('mmgLista');
    if (lista) {
        lista.innerHTML = '<div style="padding:1.2rem;text-align:center;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando integrantes...</div>';
    }
    modal.classList.remove('hidden');
    modal.classList.add('active');

    const rolColor = { presidente: '#005f73', tesorero: '#0a9396', secretario: '#ee9b00' };

    (async () => {
        try {
            const res = await apiFetch(`/comunidad/grupos/${grupoId}/miembros`);
            if (!res?.ok) throw new Error();
            const miembros = await res.json();

            if (!lista) return;
            if (!miembros.length) {
                lista.innerHTML = '<p style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">Este grupo todavía no tiene integrantes activos.</p>';
                return;
            }

            const miId = getSession()?.id;
            const miRol = miembros.find(m => m.userId == miId)?.rol?.toLowerCase();
            const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
            const esAdmin = sess.rol === 'admin' || sess.role === 'admin';
            const puedeGestionar = esAdmin || miRol === 'presidente' || miRol === 'tesorero' || miRol === 'secretario';

            lista.innerHTML = miembros.map(m => {
                const iniciales = (m.nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
                const color = rolColor[(m.rol || '').toLowerCase()] || 'var(--text-muted)';
                const esUnoMismo = m.userId == miId;
                const suspendido = (m.estado || '').toLowerCase() === 'suspended';

                // Botones de acción: dependen del estado actual del miembro
                let acciones = '';
                if (puedeGestionar && !esUnoMismo) {
                    if (suspendido) {
                        // Miembro suspendido: mostrar solo botón Reactivar
                        acciones = `
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button data-action="gestionar-miembro" data-grupo-id="${grupoId}" data-user-id="${m.userId}"
                            data-accion="activar" data-nombre="${m.nombre || 'este socio'}" title="Reactivar miembro"
                            style="background:none;border:1px solid var(--border);border-radius:6px;padding:0 8px;height:28px;cursor:pointer;color:#16a34a;font-size:.7rem;white-space:nowrap">
                            <i class="fa-solid fa-rotate-left"></i> Reactivar</button>
                        <button data-action="gestionar-miembro" data-grupo-id="${grupoId}" data-user-id="${m.userId}"
                            data-accion="expulsar" data-nombre="${m.nombre || 'este socio'}" title="Expulsar del grupo"
                            style="background:none;border:1px solid var(--border);border-radius:6px;width:28px;height:28px;cursor:pointer;color:var(--danger)">
                            <i class="fa-solid fa-user-xmark" style="font-size:.7rem"></i></button>
                    </div>`;
                    } else {
                        // Miembro activo: mostrar Suspender y Expulsar
                        acciones = `
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button data-action="gestionar-miembro" data-grupo-id="${grupoId}" data-user-id="${m.userId}"
                            data-accion="suspender" data-nombre="${m.nombre || 'este socio'}" title="Suspender"
                            style="background:none;border:1px solid var(--border);border-radius:6px;width:28px;height:28px;cursor:pointer;color:#d97706">
                            <i class="fa-solid fa-pause" style="font-size:.7rem"></i></button>
                        <button data-action="gestionar-miembro" data-grupo-id="${grupoId}" data-user-id="${m.userId}"
                            data-accion="expulsar" data-nombre="${m.nombre || 'este socio'}" title="Expulsar del grupo"
                            style="background:none;border:1px solid var(--border);border-radius:6px;width:28px;height:28px;cursor:pointer;color:var(--danger)">
                            <i class="fa-solid fa-user-xmark" style="font-size:.7rem"></i></button>
                    </div>`;
                    }
                }

                // Badge de estado suspendido
                const estadoBadge = suspendido
                    ? `<span style="font-size:.68rem;font-weight:700;color:#fff;background:#d97706;border-radius:4px;padding:1px 5px;flex-shrink:0">Suspendido</span>`
                    : '';

                return `
                <div style="display:flex;align-items:center;gap:.7rem;padding:.55rem .6rem;border:1px solid ${suspendido ? '#d97706' : 'var(--border)'};border-radius:8px;background:${suspendido ? 'rgba(217,119,6,.06)' : 'var(--bg-card)'}">
                    <div style="width:34px;height:34px;border-radius:50%;background:${suspendido ? '#d97706' : 'var(--primary)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0">${iniciales}</div>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:.85rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.nombre || 'Socio'}${esUnoMismo ? ' <span style="color:var(--text-muted);font-weight:400">(tú)</span>' : ''}</div>
                        <div style="font-size:.75rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.email || ''}</div>
                    </div>
                    <span style="font-size:.7rem;font-weight:700;color:${color};text-transform:capitalize;flex-shrink:0">${m.rol || 'miembro'}</span>
                    ${estadoBadge}
                    ${acciones}
                </div>`;
            }).join('');
        } catch {
            if (lista) lista.innerHTML = '<p style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">No se pudo cargar la lista de integrantes.</p>';
        }
    })();
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMUNIDAD
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('comunidad')) return;

    document.getElementById('_resultados')?.addEventListener('click', (e) => {
        const item = e.target.closest('[data-action="seleccionar-miembro"]');
        if (item) seleccionarMiembro(Number(item.dataset.id), item.dataset.nombre);
    });

    cargarGruposComunidad();

    const modalGrupo = document.getElementById('modalCrearGrupo');
    const cerrarGrupo = () => {
        if (modalGrupo) { modalGrupo.classList.add('hidden'); modalGrupo.style.display = 'none'; }
        // Limpiar campos al cerrar
        const gn = document.getElementById('_gnombre'); if (gn) gn.value = '';
        const gd = document.getElementById('_gdesc'); if (gd) gd.value = '';
    };
    document.getElementById('btnNuevoGrupo')?.addEventListener('click', () => {
        if (modalGrupo) { modalGrupo.classList.remove('hidden'); modalGrupo.style.display = 'flex'; }
    });
    document.getElementById('_cerrarG')?.addEventListener('click', cerrarGrupo);
    document.getElementById('_cancelarG')?.addEventListener('click', cerrarGrupo);
    modalGrupo?.addEventListener('click', e => { if (e.target === modalGrupo) cerrarGrupo(); });

    document.getElementById('_confirmarG')?.addEventListener('click', async () => {
        const nombre = document.getElementById('_gnombre')?.value?.trim();
        const tipo = document.getElementById('_gtipo')?.value || 'mixto';
        const desc = document.getElementById('_gdesc')?.value?.trim() || '';
        if (!nombre) { mostrarToast('Ingresa el nombre del grupo', 'warning'); return; }
        const btn = document.getElementById('_confirmarG');
        const htmlOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...';
        try {
            const res = await apiFetch('/comunidad/grupos', {
                method: 'POST',
                body: JSON.stringify({ nombre, tipo, descripcion: desc })
            });
            if (res?.ok) {
                mostrarToast('✅ Grupo creado', 'success');
                cerrarGrupo();
                cargarGruposComunidad();
            } else {
                const d = await res?.json().catch(() => ({}));
                mostrarToast('❌ ' + (d.mensaje || 'Error al crear el grupo'), 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = htmlOriginal; }
    });

    const modalMiembro = document.getElementById('modalAgregarMiembro');
    const cerrarModalMiembro = () => {
        if (modalMiembro) { modalMiembro.classList.add('hidden'); modalMiembro.style.display = 'none'; }
        const r = document.getElementById('_resultados'); if (r) r.innerHTML = '';
        const b = document.getElementById('_buscar'); if (b) b.value = '';
        const u = document.getElementById('_unombre'); if (u) u.textContent = '';
        const uid = document.getElementById('_uid'); if (uid) uid.value = '';
    };
    document.getElementById('_cerrarM')?.addEventListener('click', cerrarModalMiembro);
    document.getElementById('_cancelarM')?.addEventListener('click', cerrarModalMiembro);
    modalMiembro?.addEventListener('click', e => { if (e.target === modalMiembro) cerrarModalMiembro(); });

    document.getElementById('_confirmarM')?.addEventListener('click', async () => {
        const grupoId = document.getElementById('_gid')?.value;
        const userId = document.getElementById('_uid')?.value;
        const rol = document.getElementById('_rol')?.value || 'miembro';
        if (!grupoId) { mostrarToast('No se identificó el grupo', 'error'); return; }
        if (!userId) { mostrarToast('Busca y selecciona un usuario primero', 'warning'); return; }
        const btn = document.getElementById('_confirmarM');
        const htmlOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Agregando...';
        try {
            const res = await apiFetch(`/comunidad/grupos/${grupoId}/miembros`, {
                method: 'POST',
                body: JSON.stringify({ userId: parseInt(userId, 10), rol })
            });
            if (res?.ok) {
                mostrarToast('✅ Miembro agregado al grupo', 'success');
                cerrarModalMiembro();
                cargarGruposComunidad();
            } else {
                const d = await res?.json().catch(() => ({}));
                mostrarToast('❌ ' + (d.mensaje || 'Error al agregar el miembro'), 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
        finally { btn.disabled = false; btn.innerHTML = htmlOriginal; }
    });

    /* Botones "Agregar miembro" en cada grupo → abren el modal */
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="agregarMiembro"]');
        if (!btn) return;
        const grupoId = btn.dataset.grupoId || btn.closest('[data-grupo-id]')?.dataset.grupoId;
        if (modalMiembro) {
            const gidInput = document.getElementById('_gid');
            if (gidInput && grupoId) gidInput.value = grupoId;
            modalMiembro.classList.remove('hidden');
            modalMiembro.style.display = 'flex';
            document.getElementById('_buscar')?.focus();
        }
    });

    /* Botón "Miembros" en cada grupo → muestra el listado de integrantes */
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="verMiembrosGrupo"]');
        if (!btn) return;
        mostrarMiembrosGrupo(btn.dataset.grupoId, btn.dataset.grupoNombre);
    });

    /* Suspender / expulsar / reactivar un miembro desde el modal de integrantes */
    document.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action="gestionar-miembro"]');
        if (!btn) return;
        const { grupoId, userId, accion, nombre } = btn.dataset;
        const verbos = { expulsar: 'expulsar a', suspender: 'suspender a', activar: 'reactivar a' };
        const verbo = verbos[accion] || `aplicar "${accion}" a`;
        if (!confirm(`¿Seguro que quieres ${verbo} ${nombre} de este grupo?`)) return;
        try {
            const res = await apiFetch(`/comunidad/grupos/${grupoId}/miembros/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify({ accion })
            });
            if (res?.ok) {
                const mensajes = { expulsar: 'Miembro expulsado', suspender: 'Miembro suspendido', activar: 'Miembro reactivado ✅' };
                mostrarToast(mensajes[accion] || 'Acción aplicada', 'success');
                const nombreGrupo = document.getElementById('mmgGrupoNombre')?.textContent?.replace('Grupo: ', '');
                mostrarMiembrosGrupo(grupoId, nombreGrupo);
                if (typeof cargarGruposComunidad === 'function') cargarGruposComunidad();
            } else if (res?.status === 403) {
                mostrarToast('No tienes permiso para gestionar miembros de este grupo', 'error');
            } else {
                mostrarToast('No se pudo completar la acción', 'error');
            }
        } catch { mostrarToast('Error de conexión', 'error'); }
    });

    let _buscarTimeout;
    document.getElementById('_buscar')?.addEventListener('input', function () {
        clearTimeout(_buscarTimeout);
        const q = this.value.trim();
        if (q.length < 2) { const r = document.getElementById('_resultados'); if (r) r.innerHTML = ''; return; }
        _buscarTimeout = setTimeout(async () => {
            try {
                const res = await apiFetch(`/usuarios/buscar?q=${encodeURIComponent(q)}`);
                const data = res?.ok ? await res.json() : [];
                const res2 = document.getElementById('_resultados');
                if (!res2) return;
                if (!data.length) {
                    res2.innerHTML = '<p style="font-size:.8rem;color:var(--text-muted);padding:.4rem">Sin resultados</p>';
                } else {
                    res2.innerHTML = data.slice(0, 5).map(u => {
                        const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email || '—';
                        return `<div class="search-result-item" data-action="seleccionar-miembro" data-id="${u.id}" data-nombre="${nombreCompleto}">
                            <i class="fa-solid fa-user" style="color:var(--primary);margin-right:.4rem;font-size:.75rem"></i>
                            ${nombreCompleto} <small style="color:var(--text-muted)">${u.email || ''}</small>
                        </div>`;
                    }).join('');
                    /* Auto-seleccionar si hay exactamente 1 resultado */
                    if (data.length === 1) {
                        const u = data[0];
                        const nc = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email || '—';
                        seleccionarMiembro(u.id, nc);
                    }
                }
            } catch { /* silencioso */ }
        }, 350);
    });

    window.seleccionarMiembro = function (id, nombre) {
        const uid = document.getElementById('_uid');
        const unombre = document.getElementById('_unombre');
        const buscar = document.getElementById('_buscar');
        const resultados = document.getElementById('_resultados');
        if (uid) uid.value = id;
        if (unombre) unombre.textContent = '✓ Seleccionado: ' + nombre;
        if (buscar) buscar.value = nombre;
        if (resultados) resultados.innerHTML = '';
    };

    const formPost = document.getElementById('formPost');
    if (formPost) {
        const cloneForm = formPost.cloneNode(true);
        formPost.parentNode.replaceChild(cloneForm, formPost);
        cloneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mensaje = document.getElementById('mensajePost')?.value?.trim();
            if (!mensaje) { mostrarToast('Escribe algo para publicar', 'warning'); return; }
            const btn = cloneForm.querySelector('button[type="submit"]');
            if (btn) btn.disabled = true;
            try {
                const imgFile = document.getElementById('inputFile')?.files[0];
                let imagenUrl = null;
                if (imgFile) {
                    imagenUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(imgFile);
                    });
                }

                const res = await apiFetch('/comunidad/publicaciones', {
                    method: 'POST',
                    body: JSON.stringify({ contenido: mensaje, imagenUrl })
                });
                if (res?.ok) {
                    mostrarToast('✅ Publicación enviada', 'success');
                    const modalPost = document.getElementById('modalPost');
                    if (modalPost) { modalPost.classList.add('hidden'); modalPost.style.display = 'none'; }
                    cloneForm.reset();
                    document.getElementById('previewContainer')?.classList.add('hidden');
                    await cargarFeedComunidad();
                } else { mostrarToast('Error al publicar', 'error'); }
            } catch { mostrarToast('Error de conexión', 'error'); }
            finally { if (btn) btn.disabled = false; }
        });
    }

    /* Asegurar que el tab activo inicial (publicaciones) muestre su pane */
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        const paneId = 'tab-' + activeTab.dataset.tab;
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(paneId)?.classList.add('active');
    }
});
