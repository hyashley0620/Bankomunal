/**
 * =============================================================================
 * Panel
 * =============================================================================
 */

/* Variable global para el gráfico de reportes (evita duplicados) */
let chartReportes = null;

/* =============================================================================
   INICIALIZACIÓN — DOMContentLoaded DATOS
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {

    const esPaginaReportesFinancieros =
        document.getElementById('mainChart') && document.getElementById('txBody')
        && document.getElementById('distChart') && !document.getElementById('savingsChart');

    if ((document.getElementById('historialBody') || document.getElementById('txBody'))
        && !document.getElementById('tablaUsuarios')
        && !document.getElementById('historialBody')
        && !esPaginaReportesFinancieros) {
        initHistorial();
        document.getElementById('filtrar')?.addEventListener('click', ejecutarFiltros);
        document.getElementById('btnFiltrarReporte')?.addEventListener('click', ejecutarFiltros);
    }

    /* Comunidad de socios */
    if (document.getElementById('miembrosLista')) cargarMiembros();

    /* Gráfico de salud financiera (donut) */
    if (document.getElementById('healthChart') || document.getElementById('expensesDonutChart'))
        initSaludFinanciera();

    /* Gráficos BI (barras/línea)  → cargarReportesFinancieros(). */
    if ((document.getElementById('distChart') || document.getElementById('balanceChart'))
        && !esPaginaReportesFinancieros)
        initGraficosBI();

    /* Dashboard: saldo de préstamos y WebSocket */
    if (document.getElementById('saldoPrestamos')) initDashboardExtra();

    if (document.getElementById('numeroCuentaDisplay') && typeof initPaginaCuentas === 'function')
        initPaginaCuentas();
    if (document.getElementById('mainChart') && document.getElementById('savingsChart')) initDashboardCharts();

    /* Filtros de salud financiera */
    initFiltrosSalud();

    /* ── MÓDULO ADMIN ── */
    /* Admin: gestión de préstamos pendientes */
    if (document.getElementById('listaPrestamosActivos')) {
        const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
        if (sess.rol === 'admin' || sess.role === 'admin') {
            initAdminPrestamos();
        }
    }

    if (document.getElementById('btnExportar')) initAuditoria();
    if (document.getElementById('btnIniciarBackup')) initMantenimientoSistema();

    /* Tabs de navegación interna */
    initTabs();

});


/* =============================================================================
   HISTORIAL DE MOVIMIENTOS
   ============================================================================= */

let movimientosCache = [];

async function initHistorial() {
    const tbody = document.getElementById('historialBody') || document.getElementById('txBody');
    mostrarCargandoTabla(tbody, 6);
    try {
        const res = await apiFetch('/movimientos');
        if (!res?.ok) throw new Error('Sin respuesta');
        movimientosCache = await res.json();
        renderizarHistorial(movimientosCache);
        // Update charts after data loads
        if (document.getElementById('balanceChart') || document.getElementById('distChart')) {
            initGraficosBI();
        }
    } catch {
        mostrarErrorTabla(tbody, 'Error al cargar los movimientos', 6);
    }
}

function renderizarHistorial(movimientos) {
    const tbody = document.getElementById('historialBody') || document.getElementById('txBody');
    if (!tbody) return;

    if (!movimientos.length) {
        mostrarVacioTabla(tbody, 'No hay movimientos registrados', 6);
        return;
    }

    const tipoLabel = {
        deposit: 'Depósito',
        withdrawal: 'Retiro',
        transfer: 'Transferencia',
        loan_disbursement: 'Desembolso Préstamo',
        loan_payment: 'Pago Préstamo',
        fee: 'Pago Servicio',
        adjustment: 'Ajuste'
    };

    tbody.innerHTML = movimientos.map(m => {
        const esIngreso = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
        const fecha = m.fecha
            ? new Date(m.fecha).toLocaleString('es-CO', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            })
            : '-';

        return `<tr data-tipo="${m.tipo}">
            <td>${fecha}</td>
            <td><strong>${tipoLabel[m.tipo] || m.tipo}</strong></td>
            <td>${m.descripcion || '-'}</td>
            <td>${m.referencia || '-'}</td>
            <td><span class="status-badge ${m.estado === 'completed' ? 'status-success' : 'status-warning'}">
                ${m.estado === 'completed' ? 'Completado' : m.estado}</span></td>
            <td class="monto-col ${esIngreso ? 'text-ingreso' : 'text-egreso'}">
                ${esIngreso ? '+' : '-'}${formatearCOP(m.monto)}
            </td>
        </tr>`;
    }).join('');
}

async function ejecutarFiltros() {
    const fInicio = document.getElementById('fechaInicio')?.value;
    const fFin = document.getElementById('fechaFin')?.value;
    const btn = document.getElementById('filtrar') || document.getElementById('btnFiltrarReporte');

    if (!fInicio || !fFin) { mostrarToast('Selecciona un rango de fechas', 'warning'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

    try {
        const inicio = fInicio.includes('T') ? fInicio : fInicio + 'T00:00:00';
        const fin = fFin.includes('T') ? fFin : fFin + 'T23:59:59';
        const res = await apiFetch(`/movimientos?inicio=${inicio}&fin=${fin}`);
        if (res?.ok) {
            movimientosCache = await res.json();
            renderizarHistorial(movimientosCache);
            mostrarToast(`${movimientosCache.length} movimientos encontrados`, 'success');
        }
    } catch {
        mostrarToast('Error al filtrar movimientos', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-filter"></i> Aplicar'; }
    }
}


/* =============================================================================
   COMUNIDAD DE SOCIOS
   ============================================================================= */

async function cargarMiembros() {
    const lista = document.getElementById('miembrosLista');
    if (!lista) return;

    lista.innerHTML = `<div class="td-loading">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:#005F73"></i>
        <p>Cargando socios...</p></div>`;

    try {
        const res = await apiFetch('/comunidad/miembros');
        if (!res?.ok) throw new Error();
        const miembros = await res.json();

        if (!miembros.length) {
            lista.innerHTML = '<p class="text-muted-sm" style="text-align:center;padding:20px">No hay socios activos.</p>';
            return;
        }

        lista.innerHTML = miembros.map(m => `
            <div class="member-card">
                <div class="member-avatar">${m.iniciales || '?'}</div>
                <div class="member-info">
                    <strong>${m.nombre}</strong>
                    <span>${m.rol || 'Socio'}</span>
                </div>
            </div>`).join('');

    } catch {
        lista.innerHTML = '<p class="text-error" style="text-align:center">Error al cargar socios.</p>';
    }
}


/* =============================================================================
   SALUD FINANCIERA (gráfico donut)
   ============================================================================= */

async function initSaludFinanciera() {
    if (typeof Chart === 'undefined') return;

    let ingresos = 0, egresos = 0;

    try {
        const res = await apiFetch('/movimientos');
        if (res?.ok) {
            const movimientos = await res.json();
            movimientos.forEach(m => {
                if (['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo)) ingresos += parseFloat(m.monto || 0);
                else egresos += parseFloat(m.monto || 0);
            });
        }
    } catch { ingresos = 50; egresos = 50; }

    const total = ingresos + egresos || 100;
    const porcGastos = Math.round((egresos / total) * 100);
    const porcAhorro = Math.round((ingresos / total) * 100);

    const ctx = document.getElementById('healthChart') || document.getElementById('expensesDonutChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Egresos', 'Ingresos'],
            datasets: [{
                data: [porcGastos, porcAhorro],
                backgroundColor: ['#AE2012', '#0A9396'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            cutout: '78%', responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: { label: (item) => ` ${item.label}: ${item.raw}%` }
                }
            }
        }
    });

    const gastoEl = document.getElementById('porcGastos');
    const ingrEl = document.getElementById('porcIngresos');
    if (gastoEl) gastoEl.textContent = porcGastos + '%';
    if (ingrEl) ingrEl.textContent = porcAhorro + '%';
}


/* =============================================================================
   GRÁFICOS BI — últimos 7 días (historial-analisis)
   ============================================================================= */

async function initGraficosBI() {
    if (typeof Chart === 'undefined') return;

    let labels = [], ingresos = [], egresos = [];

    try {
        const hoy = new Date();
        const hace7 = new Date(hoy - 7 * 86400000);
        const f1 = hace7.toISOString().split('T')[0] + 'T00:00:00';
        const f2 = hoy.toISOString().split('T')[0] + 'T23:59:59';

        const res = await apiFetch(`/movimientos?inicio=${f1}&fin=${f2}`);
        if (res?.ok) {
            const movimientos = await res.json();
            const porDia = {};

            movimientos.forEach(m => {
                const dia = new Date(m.fecha).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
                if (!porDia[dia]) porDia[dia] = { ing: 0, egr: 0 };
                if (['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo)) porDia[dia].ing += parseFloat(m.monto || 0);
                else porDia[dia].egr += parseFloat(m.monto || 0);
            });

            labels = Object.keys(porDia);
            ingresos = labels.map(d => porDia[d].ing);
            egresos = labels.map(d => porDia[d].egr);
        }
    } catch { /* Usar datos vacíos */ }

    /* Si no hay datos reales, mostrar los últimos 7 días en cero */
    if (!labels.length) {
        const hoy = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(hoy - i * 86400000);
            labels.push(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }));
            ingresos.push(0); egresos.push(0);
        }
    }

    /* Gráfica de barras (distChart o balanceChart) */
    const ctxBar = document.getElementById('distChart') || document.getElementById('balanceChart');
    if (ctxBar) {
        /* Destruir instancia previa si existe (evita "Canvas already in use" error) */
        const prev = Chart.getChart(ctxBar);
        if (prev) prev.destroy();
        new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Ingresos', data: ingresos, backgroundColor: 'rgba(10,147,150,0.75)', borderRadius: 4 },
                    { label: 'Egresos', data: egresos, backgroundColor: 'rgba(174,32,18,0.75)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => '$ ' + Intl.NumberFormat('es-CO').format(v) }
                    }
                }
            }
        });
    }

    /* Ahorro mensual circular (historial) */
    const totalIngSav = ingresos.reduce((a, b) => a + b, 0);
    const totalEgrSav = egresos.reduce((a, b) => a + b, 0);
    const saldoNeto = Math.max(0, totalIngSav - totalEgrSav);
    const metaMensual = 500000; // meta por defecto COP
    const pctAhorro = totalIngSav > 0 ? Math.min(100, Math.round((saldoNeto / metaMensual) * 100)) : 0;

    const pctEl = document.getElementById('porcentajeAhorro');
    const metaEl = document.getElementById('mensajeMeta');
    const detEl = document.getElementById('detalleMeta');
    if (pctEl) pctEl.textContent = pctAhorro + '%';
    if (metaEl) metaEl.textContent = pctAhorro >= 100
        ? '🎉 ¡Meta alcanzada este período!'
        : pctAhorro > 0 ? `Vas al ${pctAhorro}% de tu meta mensual` : 'Sin ingresos en el período';
    if (detEl) detEl.textContent = `Meta: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(metaMensual)} / mes`;

    /* Actualizar barra circular CSS si existe */
    const progContainer = document.getElementById('progressContainer');
    if (progContainer) {
        progContainer.style.background = `conic-gradient(#005F73 ${pctAhorro * 3.6}deg, #e5e7eb 0deg)`;
    }

    /* Gráfica donut (expensesDonutChart) — si coexiste en la misma página */
    const ctxDonut = document.getElementById('expensesDonutChart');
    if (ctxDonut && ctxDonut !== ctxBar) {
        const prevDonut = Chart.getChart(ctxDonut);
        if (prevDonut) prevDonut.destroy();
        const totalIng = ingresos.reduce((a, b) => a + b, 0) || 1;
        const totalEgr = egresos.reduce((a, b) => a + b, 0) || 0;
        const pGastos = Math.round((totalEgr / (totalIng + totalEgr || 1)) * 100);
        const pAhorro = 100 - pGastos;

        new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Egresos', 'Ingresos'],
                datasets: [{
                    data: [pGastos, pAhorro],
                    backgroundColor: ['#AE2012', '#0A9396'],
                    borderWidth: 0, hoverOffset: 8
                }]
            },
            options: {
                cutout: '78%', responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (item) => ` ${item.label}: ${item.raw}%` } }
                }
            }
        });
    }
}

/* =============================================================================
   DASHBOARD — KPIs y gráficas
   ============================================================================= */

async function initDashboardExtra() {
    /* Cargar saldo real desde la cuenta */
    try {
        const rc = await apiFetch('/cuentas');
        if (rc?.ok) {
            const cuentas = await rc.json();
            const totalSaldo = cuentas.reduce((s, c) => s + (c.saldo || 0), 0);
            const saldoEl = document.getElementById('saldoGlobal');
            if (saldoEl) saldoEl.textContent = formatearCOP(totalSaldo);
            /* Actualizar sesión con saldo real */
            const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
            sess.saldoTotal = totalSaldo;
            localStorage.setItem('userSession', JSON.stringify(sess));
        }
    } catch { /* Silencioso — usa sesión guardada */ }

    try {
        const res = await apiFetch('/prestamos/mis-prestamos');
        if (!res?.ok) return;
        const data = await res.json();
        const deuda = data
            .filter(p => p.estado === 'active')
            .reduce((s, p) => s + (p.saldoPendiente || 0), 0);

        const el = document.getElementById('saldoPrestamos');
        if (el) el.textContent = formatearCOP(deuda);

        /* Próxima cuota */
        const activo = data.find(p => p.estado === 'active');
        const proxEl = document.getElementById('proximaCuota');
        if (proxEl && activo) proxEl.textContent = formatearCOP(activo.cuotaMensual || 0);

    } catch { /* Silencioso */ }

    /* Fondo común — primer grupo del usuario */
    try {
        const res = await apiFetch('/comunidad/grupos');
        if (res?.ok) {
            const grupos = await res.json();
            const fondoEl = document.getElementById('fondoComun');
            if (fondoEl && grupos.length) {
                const total = grupos.reduce((s, g) => s + (g.fondoComun || 0), 0);
                fondoEl.textContent = formatearCOP(total);
            }
        }
    } catch { /* Silencioso */ }

    if (typeof conectarWebSocket === 'function') conectarWebSocket();
}

async function initDashboardCharts() {
    if (typeof Chart === 'undefined') return;

    let labels = [], ingresos = [], egresos = [];

    try {
        const res = await apiFetch('/movimientos');
        if (res?.ok) {
            const movs = await res.json();
            const meses = {};
            movs.forEach(m => {
                const d = new Date(m.fecha || m.createdAt || Date.now());
                const key = d.toLocaleString('es-CO', { month: 'short', year: '2-digit' });
                if (!meses[key]) meses[key] = { ing: 0, egr: 0 };
                const esIngreso = ['deposit', 'loan_disbursement', 'transfer_received'].includes(m.tipo);
                if (esIngreso) meses[key].ing += parseFloat(m.monto || 0);
                else meses[key].egr += parseFloat(m.monto || 0);
            });
            const keys = Object.keys(meses).slice(-6);
            labels = keys;
            ingresos = keys.map(k => meses[k].ing);
            egresos = keys.map(k => meses[k].egr);
        }
    } catch { /* usa datos vacíos */ }

    /* Si no hay datos reales, mostrar últimos 6 meses en cero */
    if (!labels.length) {
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            labels.push(d.toLocaleString('es-CO', { month: 'short', year: '2-digit' }));
            ingresos.push(0); egresos.push(0);
        }
    }

    /* Gráfica principal: Evolución de Capital (barras) */
    const ctxMain = document.getElementById('mainChart');
    if (ctxMain) {
        new Chart(ctxMain.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Ingresos', data: ingresos, backgroundColor: 'rgba(0,95,115,0.80)', borderRadius: 6 },
                    { label: 'Egresos', data: egresos, backgroundColor: 'rgba(238,155,0,0.75)', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => '$ ' + Intl.NumberFormat('es-CO').format(v) }
                    }
                }
            }
        });
    }

    /* Gráfica ahorro: donut */
    const ctxSav = document.getElementById('savingsChart');
    if (ctxSav) {
        const totalIng = ingresos.reduce((a, b) => a + b, 0) || 1;
        const totalEgr = egresos.reduce((a, b) => a + b, 0) || 0;
        const ahorro = Math.max(0, totalIng - totalEgr);

        new Chart(ctxSav.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Ahorrado', 'Gastos'],
                datasets: [{
                    data: [ahorro, totalEgr],
                    backgroundColor: ['#005F73', '#EE9B00'],
                    borderWidth: 0, hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}


/* =============================================================================
   FILTROS DE SALUD FINANCIERA (poblar años y mes)
   ============================================================================= */

function initFiltrosSalud() {
    const mesEl = document.getElementById('filtroMes');
    const anioEl = document.getElementById('filtroAnio');
    if (!anioEl) return;

    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    anioEl.innerHTML = '';
    for (let y = curY - 4; y <= curY; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === curY) opt.selected = true;
        anioEl.appendChild(opt);
    }

    if (mesEl) mesEl.value = curM;

    const label = document.getElementById('msgFechaActualizada');
    if (label) {
        label.textContent = `Cifras actualizadas — ${now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`;
    }
}


/* =============================================================================
   TABS DE NAVEGACIÓN INTERNA COMUNIDAD
   ============================================================================= */

function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        if (btn.closest('.tab-bar')) return; // gestionado por paginas.js
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-content, .tab-panel, .tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(target)?.classList.add('active');
            document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}


/* =============================================================================
   REPORTES BI (admin — reportes-financieros)
   ============================================================================= */

async function initReportesBI() {
    actualizarGraficosReporte(); /* Cargar vacío al inicio */
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    // Intentar con /admin/reportes; si 403, usar datos propios del socio
    (async () => {
        try {
            const res = await apiFetch('/admin/reportes');
            if (res?.ok) {
                const data = await res.json();
                actualizarGraficosReporte(data);
                set('kpiCarteraTotal', data.totalPrestamos ? formatearCOP(data.totalPrestamos) : '---');
                set('kpiIndiceMora', (data.indiceMora != null ? data.indiceMora.toFixed(1) + '%' : '0.0%'));
                set('kpiSociosActivos', data.totalUsuarios ?? '---');
                set('totalMovimientos', data.totalMovimientos || 0);
                set('totalUsuarios', data.totalUsuarios || 0);
                set('totalPrestamos', data.totalPrestamos || 0);
                return;
            }
            /* 403 → socio: usar sus propios datos */
            if (res?.status === 403) {
                await cargarReportesSocio(set);
            }
        } catch { await cargarReportesSocio(set); }
    })();

    document.getElementById('btnFiltrarReporte')?.addEventListener('click', async () => {
        const f1 = document.getElementById('fechaInicio')?.value;
        const f2 = document.getElementById('fechaFin')?.value;
        const btn = document.getElementById('btnFiltrarReporte');

        if (!f1 || !f2) return mostrarToast('Seleccione un rango de fechas', 'warning');

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        btn.disabled = true;

        try {
            const inicio = f1.includes('T') ? f1 : f1 + 'T00:00:00';
            const fin = f2.includes('T') ? f2 : f2 + 'T23:59:59';
            const res = await apiFetch(`/admin/reportes?inicio=${inicio}&fin=${fin}`);

            if (res?.status === 403) {
                await cargarReportesSocio(set);
                mostrarToast('Mostrando tu actividad personal ✅', 'info');
            } else if (res?.ok) {
                const data = await res.json();
                actualizarGraficosReporte(data);
                set('kpiCarteraTotal', data.totalPrestamos ? formatearCOP(data.totalPrestamos) : '---');
                set('kpiIndiceMora', (data.indiceMora != null ? data.indiceMora.toFixed(1) + '%' : '0.0%'));
                set('kpiSociosActivos', data.totalUsuarios ?? '---');
                set('totalMovimientos', data.totalMovimientos || 0);
                set('totalUsuarios', data.totalUsuarios || 0);
                set('totalPrestamos', data.totalPrestamos || 0);
                mostrarToast('Reporte actualizado ✅', 'success');
            } else {
                const data = res ? await res.json().catch(() => ({})) : {};
                mostrarToast(data.mensaje || 'Error al obtener reporte', 'error');
            }
        } catch {
            mostrarToast('Error de conexión', 'error');
        } finally {
            btn.innerHTML = 'Filtrar';
            btn.disabled = false;
        }
    });

    /* También cargar distChart (segundo gráfico) si existe */
    if (document.getElementById('distChart')) {
        initGraficosBI();
    }
}

/* =============================================================================
   GESTIÓN DE PRÉSTAMOS (ADMIN) — aprobación y rechazo
   ============================================================================= */

async function initAdminPrestamos() {
    const tbody = document.getElementById('listaPrestamosActivos');
    if (!tbody) return;

    /* Cambiar el encabezado de la sección para admin */
    const heading = document.querySelector('h2.section-title, .loan-section h3');
    if (heading) heading.textContent = 'Gestión de Préstamos — Panel Admin';

    mostrarCargandoTabla(tbody, 7);
    try {
        const res = await apiFetch('/admin/prestamos');
        if (!res?.ok) throw new Error();
        const prestamos = await res.json();

        if (!prestamos.length) {
            mostrarVacioTabla(tbody, 'No hay préstamos pendientes', 7);
            return;
        }

        tbody.innerHTML = prestamos.map(p => {
            const estadoLower = (p.estado || '').toLowerCase();
            const cls = {
                'pending': 'status-badge status-warning',
                'approved': 'status-badge status-info',
                'active': 'status-badge status-success',
                'rejected': 'status-badge status-danger',
                'paid': 'status-badge status-info',
                'defaulted': 'status-badge status-danger',
            }[estadoLower] || 'status-badge status-neutral';

            const etiqueta = {
                'pending': 'Pendiente', 'approved': 'Aprobado', 'active': 'Activo',
                'rejected': 'Rechazado', 'paid': 'Pagado', 'defaulted': 'En mora',
            }[estadoLower] || p.estado;

            const puedeGestionar = estadoLower === 'pending';

            return `<tr data-loan-row data-estado="${estadoLower}">
                <td><strong>#${p.id}</strong></td>
                <td>${p.solicitante || p.emailSolicitante || '-'}</td>
                <td>${formatearCOP(p.montoSolicitado || 0)}</td>
                <td>${p.plazoMeses || '-'} meses</td>
                <td><span class="${cls}">${etiqueta}</span></td>
                <td>
                    ${puedeGestionar ? `
                    <button class="btn-link-sm" style="color:var(--success);background:rgba(16,185,129,.1);"
                        data-action="prestamo-accion" data-id="${p.id}" data-tipo="aprobar">
                        <i class="fa-solid fa-check"></i> Aprobar
                    </button>
                    <button class="btn-link-sm" style="color:var(--danger);background:rgba(239,68,68,.1);margin-left:4px;"
                        data-action="prestamo-accion" data-id="${p.id}" data-tipo="rechazar">
                        <i class="fa-solid fa-xmark"></i> Rechazar
                    </button>` : `<span class="text-muted" style="font-size:.8rem;">Sin acciones</span>`}
                </td>
                <td><a href="detalle-prestamos.html?id=${p.id}" class="btn-link-sm">Ver</a></td>
            </tr>`;
        }).join('');

        const setKpi = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const pendientesCount = prestamos.filter(p => (p.estado || '').toLowerCase() === 'pending').length;
        const aprobadosCount = prestamos.filter(p => ['approved', 'active'].includes((p.estado || '').toLowerCase())).length;
        const montoCartera = prestamos
            .filter(p => ['approved', 'active'].includes((p.estado || '').toLowerCase()))
            .reduce((s, p) => s + (p.montoSolicitado || 0), 0);
        setKpi('kpiTotalSolicitudes', prestamos.length);
        setKpi('kpiPrestamosPendientes', pendientesCount);
        setKpi('kpiPrestamosAprobados', aprobadosCount);
        setKpi('kpiMontoCartera', formatearCOP(montoCartera));

        // Búsqueda y filtro de estado (solo existen en gestion-prestamos)
        const aplicarFiltrosPrestamos = () => {
            const q = (document.getElementById('searchPrestamos')?.value || '').toLowerCase();
            const estadoF = document.getElementById('filtroEstadoPrestamo')?.value || '';
            document.querySelectorAll('#listaPrestamosActivos > tr[data-loan-row]').forEach(tr => {
                const texto = tr.textContent.toLowerCase();
                const estado = tr.dataset.estado || '';
                const matchQ = !q || texto.includes(q);
                const matchE = !estadoF || estado === estadoF;
                tr.style.display = (matchQ && matchE) ? '' : 'none';
            });
        };
        document.getElementById('searchPrestamos')?.addEventListener('input', aplicarFiltrosPrestamos);
        document.getElementById('filtroEstadoPrestamo')?.addEventListener('change', aplicarFiltrosPrestamos);

    } catch {
        mostrarErrorTabla(tbody, 'Error al cargar préstamos', 7);
    }
}

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="prestamo-accion"]');
    if (btn) accionPrestamo(Number(btn.dataset.id), btn.dataset.tipo);
});

window.accionPrestamo = async function (loanId, accion) {
    if (!confirm(`¿${accion === 'aprobar' ? 'Aprobar' : 'Rechazar'} el préstamo #${loanId}?`)) return;
    try {
        const res = await apiFetch(`/admin/prestamos/${loanId}/${accion}`, { method: 'PATCH' });
        if (res?.ok) {
            mostrarToast(`Préstamo ${accion === 'aprobar' ? 'aprobado ✅' : 'rechazado'}`, accion === 'aprobar' ? 'success' : 'warning');
            await initAdminPrestamos();
        } else {
            const d = await res.json().catch(() => ({}));
            mostrarToast(d.mensaje || `Error al ${accion}`, 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
};

/** Carga reportes para usuarios SOCIO usando sus propios movimientos/préstamos */
async function cargarReportesSocio(set) {
    /* Mostrar banner informativo */
    const banner = document.getElementById('reportesSocioInfo');
    if (banner) banner.classList.remove('hidden');
    try {
        const [resMov, resPrest, resCtas] = await Promise.all([
            apiFetch('/movimientos'),
            apiFetch('/prestamos/mis-prestamos'),
            apiFetch('/cuentas')
        ]);

        const movs = resMov?.ok ? await resMov.json() : [];
        const prests = resPrest?.ok ? await resPrest.json() : [];
        const ctas = resCtas?.ok ? await resCtas.json() : [];

        const ingresos = movs.filter(m => m.tipo === 'ingreso' || m.tipo === 'deposito' || m.tipo === 'INGRESO');
        const egresos = movs.filter(m => m.tipo === 'egreso' || m.tipo === 'retiro' || m.tipo === 'EGRESO');
        const totalIn = ingresos.reduce((s, m) => s + (m.monto || 0), 0);
        const totalEg = egresos.reduce((s, m) => s + (m.monto || 0), 0);
        const saldoTotal = ctas.reduce((s, c) => s + (c.saldo || 0), 0);

        set('kpiCarteraTotal', formatearCOP(saldoTotal));
        set('kpiIndiceMora', '—');
        set('kpiSociosActivos', '—');
        set('totalMovimientos', movs.length);
        set('totalPrestamos', prests.length);

        /* Construir datos para el gráfico desde movimientos propios */
        const porMes = {};
        movs.forEach(m => {
            const fecha = m.fecha || m.createdAt || '';
            const mes = fecha ? new Date(fecha).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }) : '?';
            if (!porMes[mes]) porMes[mes] = { ing: 0, eg: 0 };
            if (m.tipo === 'ingreso' || m.tipo === 'INGRESO' || m.tipo === 'deposito') porMes[mes].ing += m.monto || 0;
            else porMes[mes].eg += m.monto || 0;
        });

        const labels = Object.keys(porMes).slice(-6);
        const dataIng = labels.map(l => porMes[l].ing);
        const dataEg = labels.map(l => porMes[l].eg);

        actualizarGraficosReporte({ labels, ingresos: dataIng, egresos: dataEg });

        /* Gráfico de distribución (distChart) */
        const dc = document.getElementById('distChart');
        if (dc && typeof Chart !== 'undefined') {
            const prev = Chart.getChart(dc);
            if (prev) prev.destroy();
            new Chart(dc.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Ingresos', data: dataIng, backgroundColor: 'rgba(10,147,150,0.7)', borderRadius: 4 },
                        { label: 'Egresos', data: dataEg, backgroundColor: 'rgba(174,32,18,0.7)', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => formatearCOP(v) } } }
                }
            });
        }
    } catch { /* silencioso */ }
}

function actualizarGraficosReporte(data = null) {
    const canvas = document.getElementById('mainChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chartReportes) { chartReportes.destroy(); chartReportes = null; }

    chartReportes = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data?.labels || [],
            datasets: [
                {
                    label: 'Ingresos Operativos',
                    data: data?.ingresos || [],
                    borderColor: '#0A9396',
                    backgroundColor: 'rgba(10,147,150,0.12)',
                    fill: true, tension: 0.4, pointRadius: 4
                },
                {
                    label: 'Egresos / Créditos',
                    data: data?.egresos || [],
                    borderColor: '#AE2012',
                    backgroundColor: 'rgba(174,32,18,0.10)',
                    fill: true, tension: 0.4, pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => '$ ' + Intl.NumberFormat('es-CO').format(v) }
                }
            }
        }
    });
}

/* =============================================================================
   AUDITORÍA Y LOGS
   ============================================================================= */

async function initAuditoria() {
    cargarLogsAuditoria();
    /* alias for paginas.js listeners */
    window.cargarLogAuditoria = cargarLogsAuditoria;

    document.getElementById('btnExportar')?.addEventListener('click', async () => {
        const f1 = document.getElementById('fechaInicioAudit')?.value;
        const f2 = document.getElementById('fechaFinAudit')?.value;
        const tipo = document.getElementById('filtroTipo')?.value;
        const params = new URLSearchParams();
        if (f1 && f2) { params.set('inicio', f1 + 'T00:00:00'); params.set('fin', f2 + 'T23:59:59'); }
        if (tipo && tipo !== 'all') params.set('tipo', tipo);
        const qs = params.toString();
        await descargarArchivo('/admin/auditoria/exportar' + (qs ? `?${qs}` : ''), 'auditoria-bankomunal.xlsx');
    });

    /* Ambos IDs posibles según la versión del HTML */
    document.getElementById('btnFiltrar')?.addEventListener('click', cargarLogsAuditoria);
    document.getElementById('btnFiltrarAuditoria')?.addEventListener('click', cargarLogsAuditoria);
}

async function cargarLogsAuditoria() {
    const tbody = document.getElementById('auditLogBody') ||
        document.querySelector('#tablaAuditoria tbody') ||
        document.querySelector('#auditTable tbody');
    if (!tbody) return;

    const f1 = document.getElementById('fechaInicioAudit')?.value;
    const f2 = document.getElementById('fechaFinAudit')?.value;
    const tipo = document.getElementById('filtroTipo')?.value;

    const params = new URLSearchParams();
    if (f1 && f2) { params.set('inicio', f1 + 'T00:00:00'); params.set('fin', f2 + 'T23:59:59'); }
    if (tipo && tipo !== 'all') params.set('tipo', tipo);
    const qs = params.toString();
    const url = '/admin/auditoria' + (qs ? `?${qs}` : '');

    mostrarCargandoTabla(tbody, 6);

    try {
        const res = await apiFetch(url);
        if (!res?.ok) throw new Error();
        const logs = await res.json();

        if (!logs.length) {
            mostrarVacioTabla(tbody, 'Sin registros de auditoría', 6);
            return;
        }

        const badgeClass = (ev) => {
            if (['LOGIN_SUCCESS', 'USER_REGISTERED'].includes(ev)) return 'status-badge status-success';
            if (['LOGIN_FAILED'].includes(ev)) return 'status-badge status-error';
            return 'status-badge status-info';
        };
        const iconFor = (ev) => {
            if (ev === 'LOGIN_SUCCESS') return 'fa-circle-check';
            if (ev === 'LOGIN_FAILED') return 'fa-circle-xmark';
            if (ev === 'USER_REGISTERED') return 'fa-user-plus';
            return 'fa-bolt';
        };

        const exitosos = logs.filter(l => l.eventType === 'LOGIN_SUCCESS').length;
        const fallidos = logs.filter(l => l.eventType === 'LOGIN_FAILED').length;
        const hoy = new Date().toDateString();
        const hoyCount = logs.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === hoy).length;

        const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setEl('countEventos', hoyCount);
        setEl('countExitosos', exitosos);
        setEl('countAlertas', fallidos);
        setEl('countFallidos', fallidos);

        const badge = document.getElementById('auditCountBadge');
        if (badge) badge.textContent = `${logs.length} registros`;

        tbody.innerHTML = logs.slice(0, 100).map(l => {
            const esFallido = l.eventType?.includes('FAILED') || l.eventType?.includes('BLOCKED');
            const sevCls = esFallido ? 'sev-error' :
                l.eventType === 'LOGIN_SUCCESS' ? 'sev-ok' :
                    l.eventType?.includes('WARN') ? 'sev-warn' : 'sev-info';
            const sevLabel = esFallido ? 'Crítico' :
                l.eventType === 'LOGIN_SUCCESS' ? 'Info' :
                    l.eventType?.includes('WARN') ? 'Aviso' : 'Info';
            return `<tr>
                <td style="white-space:nowrap;font-size:.82rem;color:var(--text-muted)">
                    ${l.createdAt ? new Date(l.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                </td>
                <td style="font-size:.85rem">
                    <i class="fa-solid fa-user" style="color:#94a3b8;margin-right:4px"></i>
                    ${l.usuario?.email || l.username || '<em style="color:#94a3b8">Sistema</em>'}
                </td>
                <td><span class="status-pill ${esFallido ? 'st-danger' : 'st-success'}" style="font-size:.72rem">${l.eventType || '-'}</span></td>
                <td style="font-size:.8rem;color:var(--text-muted)">${l.ipAddress || l.objectType || '—'}</td>
                <td><span class="${sevCls}">${sevLabel}</span></td>
                <td><span class="${esFallido ? 'sev-error' : 'sev-ok'}" style="font-size:.72rem">${esFallido ? 'Alerta' : 'OK'}</span></td>
            </tr>`;
        }).join('');

    } catch {
        await cargarActividadSocio(tbody);
    }
}


/* =============================================================================
   MANTENIMIENTO Y RESPALDO
   ============================================================================= */

/** Fallback para socios: muestra sus movimientos como actividad personal */
async function cargarActividadSocio(tbody) {
    try {
        const res = await apiFetch('/movimientos');
        if (!res?.ok) { mostrarVacioTabla(tbody, 'Sin registros disponibles', 7); return; }
        const movs = await res.json();
        const session = JSON.parse(localStorage.getItem('userSession') || '{}');

        if (!movs.length) { mostrarVacioTabla(tbody, 'Sin movimientos registrados', 7); return; }

        tbody.innerHTML = movs.slice(0, 50).map(m => {
            const fecha = m.fecha || m.createdAt || '';
            const tipo = m.tipo || 'MOVIMIENTO';
            const desc = m.descripcion || m.referencia || '-';
            const monto = formatearCOP(m.monto || 0);
            const esIngreso = tipo === 'ingreso' || tipo === 'INGRESO' || tipo === 'deposito';
            return `<tr>
                <td>${fecha ? new Date(fecha).toLocaleString('es-CO') : '-'}</td>
                <td>${session.email || session.nombre || '-'}</td>
                <td>${desc}</td>
                <td>localhost</td>
                <td><span class="status-badge ${esIngreso ? 'status-success' : 'status-info'}">${tipo.toUpperCase()}</span></td>
                <td><span class="status-badge status-success">OK</span></td>
                <td>${monto}</td>
            </tr>`;
        }).join('');
    } catch { mostrarVacioTabla(tbody, 'Sin datos disponibles', 7); }
}

async function initMantenimientoSistema() {
    /* Poblar historial de backups */
    const tbody = document.getElementById('backupHistory');
    if (tbody) {
        const backups = JSON.parse(localStorage.getItem('bk_backupHistory') || '[]');
        if (backups.length) {
            tbody.innerHTML = backups.map(b => `
                <tr>
                    <td>${b.fecha}</td>
                    <td>${b.tipo}</td>
                    <td><span class="status-badge status-success">Completado</span></td>
                    <td>${b.tamaño}</td>
                    <td><button class="btn-link-sm" data-nav="${b.url}">Descargar</button></td>
                </tr>`).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Sin backups previos</td></tr>';
        }
    }

    /* Próximo backup automático */
    const nextEl = document.getElementById('nextBackupInfo');
    if (nextEl) {
        const ahora = new Date();
        const prox = new Date(ahora);
        prox.setDate(prox.getDate() + (7 - prox.getDay())); // próximo domingo
        prox.setHours(2, 0, 0, 0);
        nextEl.textContent = `Próximo backup automático: ${prox.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`;
    }

    /* Botón Iniciar Backup */
    document.getElementById('btnIniciarBackup')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const overlay = document.getElementById('backupOverlay');
        const progBar = document.getElementById('backupProgressBar');

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando respaldo...';

        /* Mostrar overlay de progreso */
        if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('active'); }

        /* Animar barra de progreso */
        let pct = 0;
        const timer = setInterval(() => {
            pct = Math.min(pct + Math.random() * 15, 90);
            if (progBar) progBar.style.width = pct + '%';
        }, 300);

        try {
            await descargarArchivo('/admin/respaldo/exportar', `backup-bankomunal-${Date.now()}.xlsx`);

            clearInterval(timer);
            if (progBar) progBar.style.width = '100%';

            /* Guardar en historial local */
            const hist = JSON.parse(localStorage.getItem('bk_backupHistory') || '[]');
            hist.unshift({
                fecha: new Date().toLocaleString('es-CO'),
                tipo: 'Completo',
                tamaño: '~' + Math.round(Math.random() * 500 + 100) + ' KB',
                url: '#'
            });
            localStorage.setItem('bk_backupHistory', JSON.stringify(hist.slice(0, 5)));

            setTimeout(() => {
                if (overlay) { overlay.classList.remove('active'); overlay.classList.add('hidden'); overlay.classList.remove('active'); }
                if (progBar) progBar.style.width = '0%';
                mostrarToast('Respaldo generado y descargado ✅', 'success');
                /* Recargar historial */
                if (tbody && hist.length) {
                    tbody.innerHTML = hist.map(b => `
                        <tr>
                            <td>${b.fecha}</td>
                            <td>${b.tipo}</td>
                            <td><span class="status-badge status-success">Completado</span></td>
                            <td>${b.tamaño}</td>
                            <td><button class="btn-link-sm">Descargar</button></td>
                        </tr>`).join('');
                }
            }, 600);
        } catch {
            clearInterval(timer);
            if (overlay) { overlay.classList.remove('active'); overlay.classList.add('hidden'); overlay.classList.remove('active'); }
            mostrarToast('Error al generar el respaldo', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-database"></i> Iniciar Backup';
        }
    });
}

/* =============================================================================
   HISTORIAL AUDITADO EN REPORTES-FINANCIEROS
   ============================================================================= */

async function cargarHistorialAuditadoReportes() {
    const tbody = document.getElementById('txBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>';

    try {
        const res = await apiFetch('/admin/auditoria');
        if (!res?.ok) throw new Error();
        const logs = await res.json();

        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8">Sin reportes auditados</td></tr>';
            return;
        }

        const tipoLabel = (ev) => {
            if (ev === 'LOGIN_SUCCESS') return 'Inicio de Sesión';
            if (ev === 'LOGIN_FAILED') return 'Intento Fallido';
            if (ev === 'USER_REGISTERED') return 'Nuevo Registro';
            if (ev === 'TRANSFER') return 'Transferencia';
            if (ev === 'LOAN_PAYMENT') return 'Pago Cuota';
            if (ev === 'EXPORT') return 'Exportación';
            return ev || 'Evento';
        };

        const estadoBadge = (ev) => {
            const ok = ['LOGIN_SUCCESS', 'USER_REGISTERED', 'TRANSFER', 'LOAN_PAYMENT', 'EXPORT'];
            const isOk = ok.includes(ev);
            return `<span class="status-badge ${isOk ? 'status-success' : 'status-error'}">${isOk ? 'Aprobado' : 'Alerta'}</span>`;
        };

        tbody.innerHTML = logs.slice(0, 50).map(l => `
            <tr>
                <td>
                    <strong>${tipoLabel(l.eventType)}</strong><br>
                    <small style="color:#94a3b8">${l.usuario?.email || 'Sistema'}</small>
                </td>
                <td style="white-space:nowrap;font-size:0.83rem;color:#64748b;">
                    ${l.createdAt ? new Date(l.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                </td>
                <td>${estadoBadge(l.eventType)}</td>
                <td class="text-right">
                    <button class="btn-link-sm" data-nav="auditoria.html">
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </td>
            </tr>`).join('');

        /* Buscador en tiempo real */
        document.getElementById('userInputSearch')?.addEventListener('input', function () {
            const q = this.value.toLowerCase();
            tbody.querySelectorAll('tr').forEach(tr => {
                tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });

    } catch {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#ef4444">Error al cargar historial</td></tr>';
    }
}

/* =============================================================================
   DASHBOARD — filtro débitos / créditos / todos en transacciones recientes
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    const filterType = document.getElementById('filterType');
    if (!filterType) return;
    filterType.addEventListener('change', function () {
        const INCOME_TYPES = ['deposit', 'loan_disbursement', 'transfer_received'];
        const allRows = document.querySelectorAll('#txBody tr');
        allRows.forEach(row => {
            const tipo = row.dataset.tipo || '';
            const esIngreso = INCOME_TYPES.includes(tipo);
            if (this.value === 'todos') row.style.display = '';
            else if (this.value === 'creditos') row.style.display = esIngreso ? '' : 'none';
            else if (this.value === 'debitos') row.style.display = !esIngreso ? '' : 'none';
        });
    });
});

/* =============================================================================
   SEGURIDAD — botón "Finalizar otras sesiones"
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('seguridad')) return;
    document.getElementById('logoutAllBtn')?.addEventListener('click', async () => {
        if (!confirm('¿Cerrar todas las demás sesiones activas? Deberás volver a iniciar sesión en otros dispositivos.')) return;
        try {
            const res = await apiFetch('/usuarios/sesiones/cerrar-otras', { method: 'POST' });
            if (res?.ok) mostrarToast('✅ Otras sesiones cerradas exitosamente', 'success');
            else mostrarToast('No se pudieron cerrar las sesiones', 'error');
        } catch { mostrarToast('Error de conexión', 'error'); }
    });
});


/* =============================================================================
   MÓDULO ADMIN: GESTIÓN DE BENEFICIOS
   ============================================================================= */

async function initAdminBeneficios() {
    const container = document.getElementById('adminBeneficiosList') ||
        document.getElementById('listaBeneficios');
    if (!container) return;

    mostrarCargandoTabla(container, 6);

    try {
        const res = await apiFetch('/beneficios/admin');
        if (!res?.ok) throw new Error('Sin respuesta');
        const beneficios = await res.json();

        if (!beneficios.length) {
            mostrarVacioTabla(container, 'No hay beneficios registrados', 5);
            return;
        }

        container.innerHTML = beneficios.map(b => `
            <tr>
                <td><strong>${b.titulo || '-'}</strong></td>
                <td>${b.tipo || '-'}</td>
                <td>${b.nivelMinimo || 'basico'}</td>
                <td>${b.tasaEspecial ? b.tasaEspecial + '%' : '-'}</td>
                <td>${b.costoPuntos ? b.costoPuntos + ' pts' : '-'}</td>
                <td>
                    <span class="status-badge ${b.activo ? 'status-success' : 'status-danger'}">
                        ${b.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn-link-sm" style="color:var(--primary)"
                        data-action="editar-beneficio" data-id="${b.id}" data-titulo="${b.titulo || ''}" data-tipo="${b.tipo || ''}" data-descripcion="${b.descripcion || ''}" data-costo="${b.costoPuntos || 0}">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn-link-sm" style="color:var(--danger);margin-left:4px"
                        data-action="eliminar-beneficio" data-id="${b.id}" data-titulo="${b.titulo || ''}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`).join('');
    } catch {
        mostrarErrorTabla(container, 'Error al cargar beneficios', 6);
    }
}

document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="editar-beneficio"]');
    if (editBtn) {
        const d = editBtn.dataset;
        editarBeneficio(Number(d.id), d.titulo, d.tipo, d.descripcion, Number(d.costo));
        return;
    }
    const delBtn = e.target.closest('[data-action="eliminar-beneficio"]');
    if (delBtn) eliminarBeneficio(Number(delBtn.dataset.id), delBtn.dataset.titulo);
});

window.editarBeneficio = async function (id, titulo, tipo, descripcion, costoPuntos) {
    const nuevoTitulo = prompt('Título del beneficio:', titulo);
    if (!nuevoTitulo) return;
    const nuevoTipo = prompt('Tipo (general/tasa_especial/taller/seguro/descuento/abono_capital):', tipo);
    const nuevaDesc = prompt('Descripción:', descripcion);
    const nuevoCosto = prompt('Costo en puntos para canjear (vacío o 0 = no se canjea con puntos):', costoPuntos || '');
    try {
        const res = await apiFetch(`/beneficios/admin/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ titulo: nuevoTitulo, tipo: nuevoTipo, descripcion: nuevaDesc, costoPuntos: nuevoCosto })
        });
        if (res?.ok) {
            mostrarToast('Beneficio actualizado ✅', 'success');
            initAdminBeneficios();
        } else {
            const d = await res.json().catch(() => ({}));
            mostrarToast(d.mensaje || 'Error al actualizar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
};

window.eliminarBeneficio = async function (id, titulo) {
    if (!confirm(`¿Desactivar el beneficio "${titulo}"?`)) return;
    try {
        const res = await apiFetch(`/beneficios/admin/${id}`, { method: 'DELETE' });
        if (res?.ok) {
            mostrarToast('Beneficio desactivado ✅', 'info');
            initAdminBeneficios();
        } else {
            mostrarToast('Error al desactivar', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
};

window.crearBeneficioAdmin = async function () {
    const titulo = prompt('Título del nuevo beneficio:');
    if (!titulo) return;
    const tipo = prompt('Tipo (general/tasa_especial/taller/seguro/descuento/abono_capital):', 'general');
    const descripcion = prompt('Descripción:', '');
    const nivelMinimo = prompt('Nivel mínimo (basico/intermedio/avanzado):', 'basico');
    const costoPuntos = prompt('Costo en puntos para canjear (vacío = no se canjea con puntos):', '');
    try {
        const res = await apiFetch('/beneficios/admin', {
            method: 'POST',
            body: JSON.stringify({ titulo, tipo, descripcion, nivelMinimo, costoPuntos })
        });
        if (res?.ok) {
            mostrarToast(`Beneficio "${titulo}" creado ✅`, 'success');
            initAdminBeneficios();
        } else {
            const d = await res.json().catch(() => ({}));
            mostrarToast(d.mensaje || 'Error al crear', 'error');
        }
    } catch { mostrarToast('Error de conexión', 'error'); }
};

// Auto-init when the admin beneficios list exists
document.addEventListener('DOMContentLoaded', () => {
    const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
    const esAdmin = sess.rol === 'admin' || sess.role === 'admin';
    if (esAdmin) {
        document.getElementById('adminBeneficiosSection')?.classList.remove('hidden');
    }
    if (esAdmin && (document.getElementById('adminBeneficiosList') || document.getElementById('listaBeneficios'))) {
        initAdminBeneficios();
    }
    if (esAdmin) {
        document.getElementById('btnNuevoBeneficio')?.addEventListener('click', crearBeneficioAdmin);
    }
});
