/* ============================================================
   ENCUESTAS Y VOTACIONES
   ============================================================ */

let todosPolls = [];
let pollVotando = null;
let tabActual = 'todas';
let misVotos = {};

/* ── Cargar votos del usuario desde el backend ───────────── */
async function cargarMisVotos() {
    try {
        const res = await apiFetch('/encuestas/mis-votos');
        if (res && res.ok) {
            const data = await res.json(); // { "12": 45, "7": 22, ... }
            // Convertir claves a número para que misVotos[p.id] funcione correctamente
            misVotos = {};
            for (const [pollId, optionId] of Object.entries(data)) {
                misVotos[parseInt(pollId)] = parseInt(optionId);
            }
        }
    } catch {
        // Si el backend falla (ej. modo demo), misVotos queda vacío
        misVotos = {};
    }
}

/* ── Cargar encuestas del backend ────────────────────────── */
async function cargarEncuestas() {
    await cargarMisVotos();
    try {
        const res = await apiFetch('/encuestas');
        if (res && res.ok) {
            todosPolls = await res.json();
        } else {
            // Demo data si el backend no está listo
            todosPolls = getDemoPolls();
        }
    } catch {
        todosPolls = getDemoPolls();
    }
    renderPolls();
    actualizarStats();
}

function getDemoPolls() {
    return [
        {
            id: 1, titulo: '¿Aumentar la cuota de ahorro mensual?', descripcion: 'Propuesta de incrementar la cuota mínima de $50.000 a $75.000 mensuales para fortalecer el fondo común.', estado: 'open', esRuleChange: true, anonima: false, opciones: [
                { id: 1, texto: 'Sí, aumentar a $75.000', votos: 8 },
                { id: 2, texto: 'No, mantener en $50.000', votos: 3 },
                { id: 3, texto: 'Aumentar a $60.000', votos: 5 }
            ]
        },
        {
            id: 2, titulo: '¿Cuándo realizar la reunión mensual?', descripcion: 'Definir el día de la semana más conveniente para todos los socios.', estado: 'open', esRuleChange: false, anonima: true, opciones: [
                { id: 4, texto: 'Sábado por la mañana', votos: 12 },
                { id: 5, texto: 'Domingo por la tarde', votos: 4 },
                { id: 6, texto: 'Viernes por la noche', votos: 7 }
            ]
        },
        {
            id: 3, titulo: '¿Admitir nuevos socios este trimestre?', descripcion: 'Votación sobre apertura de inscripciones para el período enero-marzo.', estado: 'closed', esRuleChange: false, anonima: false, opciones: [
                { id: 7, texto: 'Sí, abrir inscripciones', votos: 15 },
                { id: 8, texto: 'No por ahora', votos: 3 }
            ]
        },
        {
            id: 4, titulo: '¿Reducir la tasa de interés de préstamos?', descripcion: 'Propuesta de bajar la tasa del 2% al 1.5% mensual para hacer los préstamos más accesibles.', estado: 'open', esRuleChange: true, anonima: false, opciones: [
                { id: 9, texto: 'Sí, bajar al 1.5%', votos: 6 },
                { id: 10, texto: 'Mantener al 2%', votos: 9 },
                { id: 11, texto: 'Evaluar según el fondo', votos: 2 }
            ]
        },
        {
            id: 5, titulo: '¿Implementar pagos por QR en reuniones?', descripcion: 'Modernizar el proceso de pago de cuotas usando códigos QR en lugar de efectivo.', estado: 'open', esRuleChange: false, anonima: false, opciones: [
                { id: 12, texto: 'Sí, implementar QR', votos: 18 },
                { id: 13, texto: 'Prefiero efectivo', votos: 2 }
            ]
        }
    ];
}

/* ── Render grid ─────────────────────────────────────────── */
function renderPolls() {
    const grid = document.getElementById('pollsGrid');
    const q = (document.getElementById('buscarPoll').value || '').toLowerCase();

    let lista = todosPolls.filter(p => {
        if (q && !p.titulo.toLowerCase().includes(q) && !(p.descripcion || '').toLowerCase().includes(q)) return false;
        if (tabActual === 'abiertas' && p.estado !== 'open') return false;
        if (tabActual === 'cerradas' && p.estado !== 'closed') return false;
        if (tabActual === 'cambioregla' && !p.esRuleChange) return false;
        return true;
    });

    if (!lista.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2.5rem;color:var(--text-muted)">
            <i class="fa-solid fa-square-poll-horizontal fa-3x" style="opacity:.3"></i>
            <p style="margin-top:.8rem">No hay encuestas en esta categoría.</p></div>`;
        return;
    }

    grid.innerHTML = lista.map(p => {
        const totalVotos = p.opciones.reduce((s, o) => s + o.votos, 0);
        const yaVote = misVotos[p.id] !== undefined;
        const abierta = p.estado === 'open';
        const sess = JSON.parse(localStorage.getItem('userSession') || '{}');
        const esAdmin = sess.rol === 'admin' || sess.role === 'admin';
        const puedeCerrar = abierta && (esAdmin || (p.creadorId != null && p.creadorId == sess.id));

        const opcionesHTML = p.opciones.map(o => {
            const pct = totalVotos > 0 ? Math.round((o.votos / totalVotos) * 100) : 0;
            const esMiVoto = misVotos[p.id] === o.id;
            return `<div class="option-row">
                <div class="option-top">
                    <span>${o.texto} ${esMiVoto ? '<i class="fa-solid fa-check" style="color:var(--primary)"></i>' : ''}</span>
                    <span>${pct}% (${o.votos})</span>
                </div>
                <div class="option-bar"><div class="option-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');

        return `<div class="poll-card">
            <div class="poll-card-header">
                <div class="poll-card-title">${p.titulo}</div>
                <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">
                    <span class="poll-badge ${abierta ? 'badge-open' : 'badge-closed'}">${abierta ? '🟢 Abierta' : '🔴 Cerrada'}</span>
                    ${p.esRuleChange ? '<span class="poll-badge badge-regla">⚖️ Regla</span>' : ''}
                    ${p.anonima ? '<span class="poll-badge" style="background:#f3f0ff;color:#7c3aed">🔒 Anónima</span>' : ''}
                </div>
            </div>
            ${p.descripcion ? `<div class="poll-desc">${p.descripcion}</div>` : ''}
            <div class="poll-options">${opcionesHTML}</div>
            <div class="poll-footer">
                <div class="poll-meta">
                    <i class="fa-solid fa-users" style="font-size:.75rem"></i> ${totalVotos} votos totales
                    ${yaVote ? ' · <span style="color:var(--primary);font-weight:600">✓ Votaste</span>' : ''}
                    ${p.fechaCierre ? ` · <i class="fa-regular fa-clock" style="font-size:.7rem"></i> Cierra: ${new Date(p.fechaCierre).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:.5rem">
                ${abierta && !yaVote
                ? `<button class="btn-primary" style="font-size:.82rem;padding:.4rem .9rem" data-id="${p.id}">
                           <i class="fa-solid fa-vote-yea"></i> Votar
                       </button>`
                : abierta && yaVote
                    ? `<span style="font-size:.82rem;color:var(--text-muted);font-style:italic">Ya emitiste tu voto</span>`
                    : `<span style="font-size:.82rem;color:var(--text-muted);font-style:italic">Encuesta finalizada</span>`
            }
                ${puedeCerrar
                ? `<button class="btn-secondary" style="font-size:.78rem;padding:.4rem .8rem" data-action="cerrar-encuesta" data-id="${p.id}" title="Cerrar votación manualmente">
                           <i class="fa-solid fa-lock"></i> Cerrar
                       </button>`
                : ''
            }
                </div>
            </div>
        </div>`;
    }).join('');

    // Eventos votar
    grid.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => abrirModalVotar(parseInt(btn.dataset.id)));
    });

    // Cerrar encuesta manualmente
    grid.querySelectorAll('[data-action="cerrar-encuesta"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (!confirm('¿Cerrar esta encuesta? Ya no se podrá votar y el resultado quedará definitivo.')) return;
            btn.disabled = true;
            try {
                const res = await apiFetch(`/encuestas/${id}/cerrar`, { method: 'PATCH' });
                if (res?.ok) {
                    mostrarToast('Encuesta cerrada', 'success');
                    if (typeof cargarEncuestas === 'function') cargarEncuestas();
                } else {
                    mostrarToast('No se pudo cerrar la encuesta', 'error');
                    btn.disabled = false;
                }
            } catch {
                mostrarToast('Error de conexión', 'error');
                btn.disabled = false;
            }
        });
    });
}

/* ── Modal votar ─────────────────────────────────────────── */
function abrirModalVotar(id) {
    pollVotando = todosPolls.find(p => p.id === id);
    if (!pollVotando) return;

    document.getElementById('vModalTitulo').textContent = pollVotando.titulo;
    document.getElementById('vModalDesc').textContent = pollVotando.descripcion || '';
    document.getElementById('vModalGrupo').textContent = pollVotando.anonima ? '🔒 Votación anónima' : '';
    document.getElementById('vModalMeta').textContent = pollVotando.esRuleChange
        ? `⚖️ Cambio de regla — requiere mayoría para aplicarse`
        : '';

    document.getElementById('vModalOpciones').innerHTML = pollVotando.opciones.map(o =>
        `<label class="vote-option-label">
            <input type="radio" name="voteOpt" value="${o.id}">
            ${o.texto}
        </label>`
    ).join('');

    document.getElementById('voteModal').classList.add('open');
}

document.getElementById('closeVoteModal').addEventListener('click', () => document.getElementById('voteModal').classList.remove('open'));
document.getElementById('btnCancelarVoto').addEventListener('click', () => document.getElementById('voteModal').classList.remove('open'));

document.getElementById('btnConfirmarVoto').addEventListener('click', async () => {
    const sel = document.querySelector('input[name="voteOpt"]:checked');
    if (!sel) { mostrarToast('Selecciona una opción para votar.', 'warning'); return; }

    const optionId = parseInt(sel.value);
    const btn = document.getElementById('btnConfirmarVoto');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

    try {
        const res = await apiFetch(`/encuestas/${pollVotando.id}/votar`, {
            method: 'POST',
            body: JSON.stringify({ optionId })
        });

        if (res && !res.ok) {
            const err = await res.json().catch(() => ({}));
            mostrarToast(err.message || 'No se pudo registrar el voto.', 'error');
            return;
        }

        // El voto real queda persistido en la BD; al recargar se lee del backend.
        misVotos[pollVotando.id] = optionId;

        const opt = pollVotando.opciones.find(o => o.id === optionId);
        if (opt) opt.votos++;

        document.getElementById('voteModal').classList.remove('open');
        renderPolls();
        actualizarStats();
        mostrarToast('✅ ¡Voto registrado exitosamente!', 'success');
    } catch (e) {
        mostrarToast('Error de conexión. Intenta de nuevo.', 'error');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check-to-slot"></i> Confirmar Voto';
    }
});

/* ── Crear encuesta ──────────────────────────────────────── */
document.getElementById('btnToggleCrear').addEventListener('click', () => {
    document.getElementById('createPanel').classList.toggle('open');
});
document.getElementById('btnCancelarCrear').addEventListener('click', () => {
    document.getElementById('createPanel').classList.remove('open');
});

document.getElementById('pollCambioRegla').addEventListener('change', function () {
    document.getElementById('umbralRow').style.display = this.checked ? 'block' : 'none';
});

document.getElementById('btnAddOpcion').addEventListener('click', () => {
    const list = document.getElementById('opcionesList');
    const n = list.children.length + 1;
    const div = document.createElement('div');
    div.className = 'opcion-row';
    div.innerHTML = `<input class="opcion-input" placeholder="Opción ${n}"><button type="button" class="btn-del-op">✕</button>`;
    list.appendChild(div);
});

/* Delegación de eventos: cubre tanto las filas estáticas del HTML como las
   filas añadidas dinámicamente por "Agregar opción", sin onclick inline. */
document.getElementById('opcionesList').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-del-op');
    if (btn) eliminarOpcion(btn);
});

function eliminarOpcion(btn) {
    const list = document.getElementById('opcionesList');
    if (list.children.length <= 2) { mostrarToast('Mínimo 2 opciones.', 'warning'); return; }
    btn.closest('.opcion-row').remove();
}

document.getElementById('pollForm').addEventListener('submit', async e => {
    e.preventDefault();
    const titulo = document.getElementById('pollTitulo').value.trim();
    const desc = document.getElementById('pollDesc').value.trim();
    const anonima = document.getElementById('pollAnonima').checked;
    const cambio = document.getElementById('pollCambioRegla').checked;
    const umbral = parseInt(document.getElementById('pollUmbral').value) || 51;
    const grupoId = document.getElementById('pollGrupo').value;
    const opciones = [...document.querySelectorAll('.opcion-input')]
        .map(i => i.value.trim()).filter(Boolean);

    if (opciones.length < 2) { mostrarToast('Agrega al menos 2 opciones.', 'warning'); return; }

    const btnCrear = document.getElementById('btnCrearPoll');
    btnCrear.disabled = true; btnCrear.textContent = 'Publicando...';

    try {
        const body = { titulo, descripcion: desc, opciones, anonima, cambioRegla: cambio, umbral };
        if (grupoId) body.groupId = grupoId;
        const fechaInput = document.getElementById('pollFechaCierre');
        if (fechaInput?.value) body.fechaCierre = new Date(fechaInput.value).toISOString().slice(0, 19);

        const res = await apiFetch('/encuestas', { method: 'POST', body: JSON.stringify(body) });

        if (res && res.ok) {
            await cargarEncuestas();
        } else {
            // Fallback local si backend no responde
            const nuevaId = Date.now();
            todosPolls.unshift({
                id: nuevaId, titulo, descripcion: desc,
                estado: 'open', esRuleChange: cambio, anonima,
                opciones: opciones.map((txt, i) => ({ id: nuevaId * 100 + i, texto: txt, votos: 0 }))
            });
            renderPolls();
            actualizarStats();
        }

        document.getElementById('createPanel').classList.remove('open');
        document.getElementById('pollForm').reset();
        mostrarToast('Encuesta publicada y notificada a los miembros.', 'success');
    } catch {
        mostrarToast('Error al publicar. Intenta de nuevo.', 'error');
    } finally {
        btnCrear.disabled = false; btnCrear.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar encuesta';
    }
});

/* ── Tabs ────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tabActual = btn.dataset.tab;
        renderPolls();
    });
});

document.getElementById('buscarPoll').addEventListener('input', renderPolls);

/* ── Stats ───────────────────────────────────────────────── */
function actualizarStats() {
    const abiertas = todosPolls.filter(p => p.estado === 'open').length;
    const cerradas = todosPolls.filter(p => p.estado === 'closed').length;
    const votadas = Object.keys(misVotos).length;
    const cambioRegla = todosPolls.filter(p => p.esRuleChange).length;
    document.getElementById('statAbiertas').textContent = abiertas;
    document.getElementById('statVotadas').textContent = votadas;
    document.getElementById('statCerradas').textContent = cerradas;
    document.getElementById('statCambioRegla').textContent = cambioRegla;
}

/* ── Cargar grupos para el select ────────────────────────── */
async function cargarGrupos() {
    try {
        const res = await apiFetch('/comunidad/grupos');
        if (res && res.ok) {
            const grupos = await res.json();
            const sel = document.getElementById('pollGrupo');
            grupos.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id; opt.textContent = g.nombre;
                sel.appendChild(opt);
            });
        }
    } catch { /* silencioso */ }
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    cargarEncuestas();
    cargarGrupos();
    cargarBadgeNotificaciones();
});
