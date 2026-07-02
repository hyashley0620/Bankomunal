/* ============================================================
   EDUCACIÓN FINANCIERA
   ============================================================ */

const CURSOS = [
    {
        id: 1, cat: 'ahorro', emoji: '💰', color: '#e8f4fb',
        titulo: 'Fundamentos del Ahorro', nivel: 'Básico', duracion: '45 min',
        desc: 'Aprende a construir el hábito del ahorro y alcanzar tus metas financieras paso a paso.',
        puntos: 100,
        lecciones: [
            { titulo: '¿Por qué ahorrar?', contenido: 'El ahorro es la base de la libertad financiera. Cuando ahorras, creas una red de seguridad que te protege ante imprevistos y te permite aprovechar oportunidades.\n\n**Regla del 50/30/20:** Dedica el 50% de tus ingresos a necesidades, 30% a deseos y 20% al ahorro.\n\nEmpieza con pequeñas cantidades. Ahorrar $5.000 diarios equivale a más de $1.800.000 al año.', quiz: { pregunta: '¿Cuánto recomienda destinar la regla 50/30/20 al ahorro?', opciones: ['10%', '15%', '20%', '25%'], correcta: 2 } },
            { titulo: 'Metas de ahorro', contenido: 'Una meta de ahorro clara multiplica tu motivación. Define:\n\n• **Qué** quieres lograr (fondo de emergencia, viaje, educación)\n• **Cuánto** necesitas exactamente\n• **Cuándo** lo quieres alcanzar\n\nDivide el monto total entre los meses disponibles para saber cuánto ahorrar cada mes.', quiz: { pregunta: '¿Cuál es el primer paso para establecer una meta de ahorro?', opciones: ['Abrir una cuenta bancaria', 'Definir qué quieres lograr', 'Pedir un préstamo', 'Calcular tus gastos'], correcta: 1 } },
            { titulo: '🏆 ¡Curso completado!', contenido: 'Has aprendido los fundamentos del ahorro. Ahora tienes las herramientas para:\n\n Aplicar la regla 50/30/20\n Establecer metas de ahorro SMART\n Construir un fondo de emergencia\n\n¡Obtén tu certificado!', esFinal: true }
        ]
    },
    {
        id: 2, cat: 'credito', emoji: '🏦', color: '#fef3e2',
        titulo: 'Crédito Responsable', nivel: 'Básico', duracion: '60 min',
        desc: 'Entiende cómo funcionan los créditos, las tasas de interés y cómo mantener un buen historial crediticio.',
        puntos: 150,
        lecciones: [
            { titulo: '¿Qué es el crédito?', contenido: 'El crédito es una herramienta financiera que te permite usar dinero que no tienes hoy, con el compromiso de devolverlo en el futuro, más un interés.\n\n**Tipos de crédito:**\n• Crédito de consumo (compras)\n• Crédito hipotecario (vivienda)\n• Microcrédito (emprendimientos)\n• Crédito bancomunal (solidario)', quiz: { pregunta: '¿Qué es el interés en un crédito?', opciones: ['Un regalo del banco', 'El costo por usar dinero prestado', 'Un descuento', 'Un impuesto'], correcta: 1 } },
            { titulo: 'Historial crediticio', contenido: 'Tu historial crediticio es tu "reputación financiera". Los bancos lo consultan antes de prestarte dinero.\n\n**Factores que lo afectan:**\n• Pagar a tiempo \n• No sobrepasar el 30% del cupo de tu tarjeta \n• No solicitar muchos créditos seguidos \n\nUn buen historial te da acceso a mejores tasas.', quiz: { pregunta: '¿Cuál es la principal forma de mejorar tu historial crediticio?', opciones: ['Solicitar más tarjetas', 'Pagar a tiempo siempre', 'Cerrar todas tus deudas', 'No usar crédito'], correcta: 1 } },
            { titulo: 'Simulación de préstamos', contenido: 'Antes de tomar un crédito, simúlalo. Considera:\n\n• **Tasa de interés mensual:** en Bankomunal es del 2% mensual\n• **Plazo:** el tiempo que tienes para pagar\n• **Cuota mensual:** lo que pagas cada mes\n\nUsa nuestro simulador para calcular cuánto pagarás en total antes de comprometerte.', quiz: { pregunta: 'Si pides $1.000.000 a 6 meses al 2% mensual, ¿cuál es la cuota aproximada?', opciones: ['$150.000', '$178.526', '$200.000', '$166.000'], correcta: 1 } },
            { titulo: '🏆 ¡Curso completado!', contenido: 'Ahora eres un experto en crédito responsable. Recuerda:\n\n Usa el crédito como herramienta, no como ingreso\n Simula siempre antes de solicitar\n Paga puntualmente para construir buen historial\n\n¡Obtén tu certificado!', esFinal: true }
        ]
    },
    {
        id: 3, cat: 'presupuesto', emoji: '📊', color: '#f0f7ff',
        titulo: 'Presupuesto Personal', nivel: 'Intermedio', duracion: '50 min',
        desc: 'Construye un presupuesto mensual que funcione para ti y toma control de tus finanzas.',
        puntos: 120,
        lecciones: [
            { titulo: 'Ingresos y gastos', contenido: 'El primer paso es conocer exactamente cuánto entra y cuánto sale.\n\n**Ingresos:** salario, arriendos, ventas, remesas\n**Gastos fijos:** arriendo, servicios, cuotas\n**Gastos variables:** alimentación, transporte, ocio\n\nDurante un mes anota TODOS tus gastos, por pequeños que sean.', quiz: { pregunta: '¿Cuál de estos es un gasto fijo?', opciones: ['Cine', 'Mercado', 'Arriendo', 'Restaurante'], correcta: 2 } },
            { titulo: 'Construir el presupuesto', contenido: 'Con tus ingresos y gastos identificados:\n\n1. Lista todos los ingresos del mes\n2. Resta los gastos fijos obligatorios\n3. Asigna una cantidad al ahorro (20% mínimo)\n4. El resto es para gastos variables\n\n**Si gastas más de lo que ganas:** identifica qué gastos puedes reducir.', quiz: { pregunta: '¿Qué debes hacer primero al construir un presupuesto?', opciones: ['Ahorrar', 'Pagar deudas', 'Identificar ingresos y gastos', 'Invertir'], correcta: 2 } },
            { titulo: '🏆 ¡Curso completado!', contenido: '¡Excelente! Ahora sabes cómo:\n\n Registrar ingresos y gastos\n Identificar gastos eliminables\n Construir un presupuesto equilibrado\n\n¡Obtén tu certificado!', esFinal: true }
        ]
    },
    {
        id: 4, cat: 'inversion', emoji: '📈', color: '#f3eefa',
        titulo: 'Inversión para Principiantes', nivel: 'Avanzado', duracion: '75 min',
        desc: 'Descubre cómo hacer crecer tu dinero con conceptos básicos de inversión colectiva y bankomunal.',
        puntos: 200,
        lecciones: [
            { titulo: '¿Qué es invertir?', contenido: 'Invertir es poner tu dinero a trabajar para generar más dinero. A diferencia del ahorro (que protege), la inversión busca crecer.\n\n**Riesgo vs. rentabilidad:** mayor rentabilidad esperada = mayor riesgo.\n\nEn Bankomunal el fondo común actúa como una inversión colectiva: todos aportan y todos se benefician de los intereses de los préstamos.', quiz: { pregunta: '¿Cuál es la diferencia principal entre ahorrar e invertir?', opciones: ['Son lo mismo', 'Invertir busca crecer el dinero', 'Ahorrar es más rentable', 'Invertir no tiene riesgo'], correcta: 1 } },
            { titulo: 'El poder del interés compuesto', contenido: 'El interés compuesto es ganar intereses sobre tus intereses.\n\n**Ejemplo:** Si inviertes $1.000.000 al 2% mensual:\n• Mes 1: $1.020.000\n• Mes 6: $1.126.162\n• Mes 12: $1.268.242\n\nEinstein lo llamó "la octava maravilla del mundo". Empieza cuanto antes.', quiz: { pregunta: '¿En qué consiste el interés compuesto?', opciones: ['Interés sobre el capital inicial', 'Interés sobre intereses acumulados', 'Un tipo de crédito', 'Un seguro'], correcta: 1 } },
            { titulo: 'Fondos comunes en Bankomunal', contenido: 'El fondo común de tu grupo es una forma de inversión colectiva:\n\n• Cada miembro aporta periódicamente\n• Los fondos se usan para préstamos internos\n• Los intereses cobrados regresan al fondo\n• Todos los socios se benefician\n\nEs inversión solidaria: ganas tú, gana tu comunidad.', quiz: { pregunta: '¿De dónde provienen los rendimientos del fondo común?', opciones: ['Del banco', 'De los intereses de préstamos internos', 'Del gobierno', 'De donaciones'], correcta: 1 } },
            { titulo: '🏆 ¡Curso completado!', contenido: '¡Felicitaciones! Ahora entiendes:\n\n La diferencia entre ahorro e inversión\n El poder del interés compuesto\n Cómo funciona el fondo común de Bankomunal\n\n¡Obtén tu certificado!', esFinal: true }
        ]
    },
    {
        id: 5, cat: 'ahorro', emoji: '🎯', color: '#e8f8ee',
        titulo: 'Fondo de Emergencia', nivel: 'Básico', duracion: '30 min',
        desc: 'Aprende a construir un colchón financiero que te proteja de los imprevistos de la vida.',
        puntos: 80,
        lecciones: [
            { titulo: '¿Para qué sirve?', contenido: 'Un fondo de emergencia es dinero líquido guardado exclusivamente para situaciones imprevistas: pérdida de empleo, enfermedad, reparación urgente.\n\n**Meta recomendada:** 3 a 6 meses de gastos básicos.\n\nSin este fondo, cualquier imprevisto puede llevarte a endeudarte.', quiz: { pregunta: '¿Cuántos meses de gastos debe cubrir un fondo de emergencia?', opciones: ['1 mes', '3 a 6 meses', '12 meses', 'No importa'], correcta: 1 } },
            { titulo: '🏆 ¡Curso completado!', contenido: '¡Muy bien! Ahora sabes que:\n\n Un fondo de emergencia es tu primera prioridad financiera\n Debe cubrir entre 3 y 6 meses de gastos\n Debe estar líquido, no invertido\n\n¡Obtén tu certificado!', esFinal: true }
        ]
    }
];

/* ── Estado local ─────────────────────────────────────────── */
let progreso = JSON.parse(localStorage.getItem('bkm_edu_progreso') || '{}');
// progreso[cursoId] = { leccionActual: 0, completado: false, cert: false }

let cursoActual = null, leccionActual = 0, catActual = 'todos';

/* ── Guardar progreso ─────────────────────────────────────── */
function guardarProgreso() {
    localStorage.setItem('bkm_edu_progreso', JSON.stringify(progreso));
}

/* ── Renderizar tarjetas ─────────────────────────────────── */
function renderCursos(cat = 'todos') {
    const grid = document.getElementById('cursosGrid');
    const q = (document.getElementById('buscarCurso')?.value || '').toLowerCase();
    const lista = CURSOS.filter(c =>
        (cat === 'todos' || c.cat === cat) &&
        (c.titulo.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
    );

    if (!lista.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted)"><i class="fa-solid fa-search fa-2x"></i><p style="margin-top:.6rem">Sin resultados para "${q}"</p></div>`;
        return;
    }

    grid.innerHTML = lista.map(c => {
        const p = progreso[c.id] || {};
        const pc = p.completado ? 100 : Math.round(((p.leccionActual || 0) / c.lecciones.length) * 100);
        let btnClass = 'btn-iniciar', btnTxt = 'Iniciar curso', btnIcon = 'fa-play';
        if (p.completado) { btnClass = 'btn-completado'; btnTxt = 'Completado ✓'; btnIcon = 'fa-check'; }
        else if (pc > 0) { btnClass = 'btn-continuar'; btnTxt = 'Continuar'; btnIcon = 'fa-forward'; }

        return `<div class="course-card">
            <div class="course-banner" style="background:${c.color}">${c.emoji}</div>
            <div class="course-body">
                <div class="course-meta">
                    <span class="badge-pill badge-nivel">${c.nivel}</span>
                    <span class="badge-pill badge-dur"><i class="fa-regular fa-clock"></i> ${c.duracion}</span>
                    <span class="badge-pill badge-dur"><i class="fa-solid fa-star" style="color:#f39c12"></i> ${c.puntos} pts</span>
                </div>
                <div class="course-title">${c.titulo}</div>
                <div class="course-desc">${c.desc}</div>
                <div class="progress-wrap">
                    <div class="progress-label"><span>Progreso</span><span>${pc}%</span></div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${pc}%"></div></div>
                </div>
                <button class="btn-curso ${btnClass}" data-id="${c.id}" ${p.completado ? 'disabled' : ''}>
                    <i class="fa-solid ${btnIcon}"></i> ${btnTxt}
                </button>
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => abrirCurso(parseInt(btn.dataset.id)));
    });
}

/* ── Abrir curso / lección ───────────────────────────────── */
function abrirCurso(id) {
    cursoActual = CURSOS.find(c => c.id === id);
    if (!cursoActual) return;
    if (!progreso[id]) progreso[id] = { leccionActual: 0, completado: false, cert: false };
    leccionActual = progreso[id].leccionActual || 0;
    renderLeccion();
    document.getElementById('lessonModal').classList.add('open');
}

function renderLeccion() {
    const lec = cursoActual.lecciones[leccionActual];
    document.getElementById('lessonCursoNombre').textContent = cursoActual.titulo + ` — Lección ${leccionActual + 1}/${cursoActual.lecciones.length}`;
    document.getElementById('lessonTitulo').textContent = lec.titulo;
    document.getElementById('lessonContenido').innerHTML = lec.contenido.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

    const quizEl = document.getElementById('quizBlock');
    const certEl = document.getElementById('certModal');
    document.getElementById('quizResultado').textContent = '';

    if (lec.esFinal) {
        quizEl.style.display = 'none';
        certEl.classList.remove('hidden');
        document.getElementById('certCursoNombre').textContent = cursoActual.titulo;
        document.getElementById('btnSiguienteLeccion').innerHTML = '<i class="fa-solid fa-check"></i> Finalizar';
    } else {
        certEl.classList.add('hidden');
        if (lec.quiz) {
            quizEl.style.display = 'block';
            document.getElementById('quizPregunta').textContent = lec.quiz.pregunta;
            document.getElementById('quizOpciones').innerHTML = lec.quiz.opciones.map((op, i) =>
                `<label class="quiz-opt"><input type="radio" name="quiz" value="${i}"> <span>${op}</span></label>`
            ).join('');
        } else {
            quizEl.style.display = 'none';
        }
        document.getElementById('btnSiguienteLeccion').innerHTML = 'Siguiente <i class="fa-solid fa-arrow-right"></i>';
    }

    document.getElementById('btnAnteriorLeccion').disabled = leccionActual === 0;
}

/* ── Navegar lecciones ───────────────────────────────────── */
document.getElementById('btnSiguienteLeccion').addEventListener('click', () => {
    const lec = cursoActual.lecciones[leccionActual];

    // Validar quiz si existe
    if (lec.quiz && !lec.esFinal) {
        const sel = document.querySelector('input[name="quiz"]:checked');
        if (!sel) { mostrarToast('Selecciona una respuesta antes de continuar.', 'warning'); return; }
        const correcto = parseInt(sel.value) === lec.quiz.correcta;
        const res = document.getElementById('quizResultado');
        res.className = 'quiz-result ' + (correcto ? 'correct' : 'wrong');
        res.textContent = correcto ? '✅ ¡Correcto!' : '❌ Incorrecto. Revisa el contenido e intenta de nuevo.';
        if (!correcto) return;
    }

    if (lec.esFinal) {
        // Completar curso
        progreso[cursoActual.id].completado = true;
        progreso[cursoActual.id].cert = true;
        guardarProgreso();
        document.getElementById('lessonModal').classList.remove('open');
        renderCursos(catActual);
        actualizarStats();
        renderCerts();
        mostrarToast('🎉 ¡Curso completado! Certificado disponible.', 'success');
        syncProgresoBackend(cursoActual.id, true, cursoActual.titulo, cursoActual.puntos);
        return;
    }

    leccionActual++;
    progreso[cursoActual.id].leccionActual = leccionActual;
    guardarProgreso();
    syncProgresoBackend(cursoActual.id, false, cursoActual.titulo, cursoActual.puntos);
    renderLeccion();
});

document.getElementById('btnAnteriorLeccion').addEventListener('click', () => {
    if (leccionActual > 0) { leccionActual--; renderLeccion(); }
});

document.getElementById('closeLessonModal').addEventListener('click', () => {
    document.getElementById('lessonModal').classList.remove('open');
    document.getElementById('certModal')?.classList.add('hidden');
    renderCursos(catActual);
});
document.getElementById('closeCertModal')?.addEventListener('click', () => {
    document.getElementById('certModal').classList.add('hidden');
});

/* ── Generar PDF de certificado en el cliente con jsPDF ── */

document.getElementById('certList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'descargar-cert-local') {
        descargarCertificadoPorId(Number(btn.dataset.id), btn.dataset.titulo);
    } else if (btn.dataset.action === 'generar-cert-pdf') {
        generarCertificadoPDF(btn.dataset.nombre, btn.dataset.codigo);
    }
});

async function generarCertificadoPDF(cursoNombre, codigoCert) {
    /* Cargar jsPDF dinámicamente si no está disponible */
    if (typeof window.jspdf === 'undefined') {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    const { jsPDF } = window.jspdf;
    const session = typeof getSession === 'function' ? getSession() : {};
    const nombre = session.nombre || 'Participante';
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const codigo = codigoCert || ('BKM-EDU-' + Date.now());

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    /* Fondo degradado simulado con rectángulos */
    doc.setFillColor(0, 95, 115);   /* azul oscuro */
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(14, 134, 159);
    doc.rect(8, 8, W - 16, H - 16, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(14, 14, W - 28, H - 28, 'F');

    /* Línea decorativa */
    doc.setDrawColor(0, 95, 115);
    doc.setLineWidth(1.2);
    doc.rect(18, 18, W - 36, H - 36);

    /* Logo / título institucional */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(0, 95, 115);
    doc.text('BANKOMUNAL', W / 2, 38, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Gestión de Microfinanzas Comunitarias', W / 2, 46, { align: 'center' });

    /* Separador */
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(40, 52, W - 40, 52);

    /* Cuerpo del certificado */
    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text('Certifica que', W / 2, 66, { align: 'center' });

    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 95, 115);
    doc.text(nombre, W / 2, 80, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('ha completado satisfactoriamente el curso de Educación Financiera:', W / 2, 91, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 95, 115);
    doc.text(cursoNombre, W / 2, 104, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Fecha de emisión: ${fecha}`, W / 2, 116, { align: 'center' });
    doc.text(`Código de verificación: ${codigo}`, W / 2, 124, { align: 'center' });

    /* Pie */
    doc.setDrawColor(200, 200, 200);
    doc.line(40, 132, W - 40, 132);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Este certificado acredita la participación y aprobación del curso indicado.', W / 2, 140, { align: 'center' });
    doc.text('Bankomunal — Plataforma de Microfinanzas Comunitarias © 2026', W / 2, 147, { align: 'center' });

    /* Descargar */
    const nombreArchivo = `certificado-${cursoNombre.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    doc.save(nombreArchivo);
}

/* ── Descargar certificado ── */
document.getElementById('btnDescargarCert').addEventListener('click', async () => {
    if (!cursoActual) return;
    mostrarToast('📄 Generando certificado...', 'info');
    try {
        /* 1. Asegurar que el certificado exista en el backend */
        let codigoCert = progreso[cursoActual.id]?.codigoCert;
        if (!codigoCert) {
            const res = await apiFetch(`/educacion/cursos/${cursoActual.id}/certificado`, {
                method: 'POST',
                body: JSON.stringify({ cursoNombre: cursoActual.titulo, puntos: cursoActual.puntos })
            });
            if (res?.ok) {
                const data = await res.json();
                codigoCert = data.codigoCertificado;
                if (!progreso[cursoActual.id]) progreso[cursoActual.id] = {};
                progreso[cursoActual.id].codigoCert = codigoCert;
                guardarProgreso();
            }
        }

        /* 2. Intentar descarga desde el backend */
        const resPdf = await apiFetch(`/educacion/certificados/${cursoActual.id}/pdf`);
        if (resPdf?.ok) {
            const blob = await resPdf.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `certificado-${cursoActual.titulo.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
            a.click();
            URL.revokeObjectURL(url);
            mostrarToast(' Certificado descargado — ábrelo en el navegador y usa Ctrl+P para guardar como PDF.', 'success');
        } else {
            /* Fallback: generar en cliente con jsPDF si el backend devuelve 404 (curso no completado en BD) */
            await generarCertificadoPDF(cursoActual.titulo, codigoCert);
            mostrarToast(' Certificado PDF generado localmente.', 'success');
        }
    } catch (err) {
        console.error('Error al generar certificado:', err);
        mostrarToast('No se pudo generar el certificado. Intenta de nuevo.', 'error');
    }
    document.getElementById('certModal')?.classList.add('hidden');
    document.getElementById('lessonModal')?.classList.remove('open');
    renderCursos(catActual);
    renderCerts();
});

/* ── Descargar certificado desde lista de "Mis certificados" ── */
async function descargarCertBackend(cursoId, cursoTitulo) {
    mostrarToast('📄 Descargando certificado oficial...', 'info');
    try {
        const res = await apiFetch(`/educacion/certificados/${cursoId}/pdf`);
        if (res?.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `certificado-${cursoTitulo.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
            a.click();
            URL.revokeObjectURL(url);
            mostrarToast(' Abre el archivo en el navegador y usa Ctrl+P → Guardar como PDF.', 'success');
        } else {
            /* Fallback local */
            const codigoCert = progreso[cursoId]?.codigoCert;
            await generarCertificadoPDF(cursoTitulo, codigoCert);
            mostrarToast(' Certificado generado localmente.', 'success');
        }
    } catch {
        mostrarToast('No se pudo descargar el certificado.', 'error');
    }
}

/* ── Filtros ─────────────────────────────────────────────── */
document.querySelectorAll('.filtro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        catActual = btn.dataset.cat;
        renderCursos(catActual);
    });
});

document.getElementById('buscarCurso')?.addEventListener('input', () => renderCursos(catActual));

/* ── Stats ───────────────────────────────────────────────── */
function actualizarStats() {
    const completados = Object.values(progreso).filter(p => p.completado).length;
    const enCurso = Object.values(progreso).filter(p => !p.completado && p.leccionActual > 0).length;
    const certs = Object.values(progreso).filter(p => p.cert).length;
    const puntos = CURSOS.filter(c => progreso[c.id]?.completado).reduce((acc, c) => acc + c.puntos, 0);
    document.getElementById('statCompletados').textContent = completados;
    document.getElementById('statEnCurso').textContent = enCurso;
    document.getElementById('statCerts').textContent = certs;
    document.getElementById('statPuntos').textContent = puntos;
}

/* ── Certificados ────────────────────────────────────────── */
function renderCerts() {
    const list = document.getElementById('certList');
    const completados = CURSOS.filter(c => progreso[c.id]?.cert);
    if (!completados.length) {
        list.innerHTML = `<p style="color:var(--text-muted);font-size:.88rem;padding:.5rem 0">Completa un curso para obtener tu primer certificado.</p>`;
        return;
    }
    list.innerHTML = completados.map(c =>
        `<div style="display:flex;align-items:center;gap:1rem;padding:.8rem;border:1px solid var(--border);border-radius:10px;margin-bottom:.7rem;background:var(--bg-main)">
            <span style="font-size:2rem">${c.emoji}</span>
            <div style="flex:1">
                <div style="font-weight:600;font-size:.92rem">${c.titulo}</div>
                <div style="font-size:.78rem;color:var(--text-muted)">${c.puntos} puntos · Completado${progreso[c.id]?.codigoCert ? ' · ' + progreso[c.id].codigoCert : ''}</div>
            </div>
            <button class="btn-secondary" style="font-size:.78rem;padding:.35rem .7rem" data-action="descargar-cert-local" data-id="${c.id}" data-titulo="${c.titulo}" title="Descargar certificado oficial">
                <i class="fa-solid fa-download"></i> Descargar
            </button>
        </div>`
    ).join('');
}

/* Descarga el certificado de un curso (backend-first, fallback local) */
async function descargarCertificadoPorId(cursoId, cursoTitulo) {
    await descargarCertBackend(cursoId, cursoTitulo);
}

/* ── Backend sync ────────────────────────────────────────── */

/**
 * Sincroniza el avance del curso con el backend (POST /api/educacion/cursos/:id/avanzar)
 * y cuando se completa emite el certificado (POST /api/educacion/cursos/:id/certificado)
 */
async function syncProgresoBackend(cursoId, completado, cursoNombre, puntos) {
    try {
        await apiFetch(`/educacion/cursos/${cursoId}/avanzar`, {
            method: 'POST',
            body: JSON.stringify({ leccionActual, cursoNombre, puntos })
        });
        if (completado) {
            const res = await apiFetch(`/educacion/cursos/${cursoId}/certificado`, {
                method: 'POST',
                body: JSON.stringify({ cursoNombre, puntos })
            });
            if (res?.ok) {
                const data = await res.json();
                if (data.codigoCertificado) {
                    // Guardar código de certificado en progreso local
                    if (!progreso[cursoId]) progreso[cursoId] = {};
                    progreso[cursoId].codigoCert = data.codigoCertificado;
                    guardarProgreso();
                }
            }
        }
    } catch { /* silencioso — progreso guardado localmente */ }
}

/**
 * Carga el progreso del backend al iniciar y fusiona con el local.
 */
async function sincronizarCursosBackend() {
    try {
        const res = await apiFetch('/educacion/cursos');
        if (!res?.ok) return;
        const cursosBackend = await res.json();
        cursosBackend.forEach(cb => {
            if (!progreso[cb.id]) progreso[cb.id] = {};
            if (cb.leccionActual > (progreso[cb.id].leccionActual || 0)) {
                progreso[cb.id].leccionActual = cb.leccionActual;
            }
            if (cb.completado) progreso[cb.id].completado = true;
            if (cb.certificado) progreso[cb.id].cert = true;
        });
        guardarProgreso();
        renderCursos(catActual);
        actualizarStats();
        renderCerts();
    } catch { /* silencioso — usa datos locales */ }
}

/**
 * Obtiene los certificados del backend y actualiza la lista.
 */
async function cargarCertificadosBackend() {
    try {
        const res = await apiFetch('/educacion/certificados');
        if (!res?.ok) return;
        const certs = await res.json();
        const list = document.getElementById('certList');
        if (!list || !certs.length) return;
        const extra = certs.filter(c => !CURSOS.find(cur => cur.id === c.cursoId));
        if (extra.length) {
            extra.forEach(c => {
                list.insertAdjacentHTML('beforeend', `
                    <div style="display:flex;align-items:center;gap:1rem;padding:.8rem;border:1px solid var(--border);border-radius:10px;margin-bottom:.7rem;background:var(--bg-main)">
                        <span style="font-size:2rem">🏅</span>
                        <div style="flex:1">
                            <div style="font-weight:600;font-size:.92rem">${c.cursoNombre || 'Curso'}</div>
                            <div style="font-size:.78rem;color:var(--text-muted)">Código: ${c.codigoCertificado || '-'}</div>
                        </div>
                        <button class="btn-secondary" style="font-size:.78rem;padding:.35rem .7rem" data-action="generar-cert-pdf" data-nombre="${(c.cursoNombre || 'Curso')}" data-codigo="${c.codigoCertificado || ''}">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>`);
            });
        }
    } catch { /* silencioso */ }
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    renderCursos();
    actualizarStats();
    renderCerts();
    cargarBadgeNotificaciones();
    // Sincronizar con backend (no bloquea el render local)
    sincronizarCursosBackend().then(() => cargarCertificadosBackend());
});
