/**
 * =============================================================================
 * Capa central de comunicación con el backend.
 * Proporciona: autenticación JWT, fetch con token, descarga de archivos
 * y conexión WebSocket para notificaciones en tiempo real.
 *
 * Dependencia: cargarse ANTES que cualquier otro script del proyecto.
 * =============================================================================
 */

/* -----------------------------------------------------------------------------
   CONFIGURACIÓN
----------------------------------------------------------------------------- */

/** URL base del backend. */
const API_BASE = 'http://localhost:8080/api';


/* -----------------------------------------------------------------------------
   SESIÓN Y TOKEN
----------------------------------------------------------------------------- */

/** Obtiene el token JWT almacenado en localStorage. */
function getToken() {
    return localStorage.getItem('authToken');
}

/** Obtiene el objeto de sesión del usuario. */
function getSession() {
    const s = JSON.parse(localStorage.getItem('userSession') || '{}');
    if (s.fotoUrl) {
        const normalizada = normalizarFotoUrlRelativa(s.fotoUrl);
        if (normalizada !== s.fotoUrl) {
            s.fotoUrl = normalizada;
            localStorage.setItem('userSession', JSON.stringify(s));
        }
    }
    return s;
}

/** Cierra sesión: limpia storage y redirige al login. */
function cerrarSesion() {
    localStorage.clear();
    sessionStorage.clear();
    const enPaginas = window.location.pathname.includes('/pages/');
    window.location.replace(enPaginas ? '../login.html' : 'login.html');
}


/* -----------------------------------------------------------------------------
   FETCH AUTENTICADO
----------------------------------------------------------------------------- */

/**
 * Wrapper de fetch() que inyecta el token JWT.
 * Si el servidor responde 401 (token expirado), cierra sesión automáticamente.
 * @param {string} endpoint  Ruta relativa, ej: '/cuentas'
 * @param {Object} options   Opciones estándar de fetch()
 */
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    if (response.status === 401) {
        cerrarSesion();
        return;
    }

    return response;
}


/* -----------------------------------------------------------------------------
   FOTO DE PERFIL
----------------------------------------------------------------------------- */

/**
 * Normaliza una ruta relativa de foto almacenada en la BD a la forma canónica */
function normalizarFotoUrlRelativa(url) {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('/uploads/')) return url;
    if (url.startsWith('/fotos/')) return '/uploads' + url;
    if (url.startsWith('fotos/')) return '/uploads/' + url;
    // Cualquier otra ruta relativa: anteponer /uploads/
    return url.startsWith('/') ? url : '/uploads/' + url;
}

/** Convierte una ruta relativa de foto en URL absoluta apuntando al backend.
 *  Normaliza automáticamente rutas legacy ("fotos/...") antes de construir la URL. */
function urlFotoAbsoluta(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith('http')) return url;
    // Normalizar ruta relativa antes de anteponer el origen
    const relativa = normalizarFotoUrlRelativa(url);
    return 'http://localhost:8080' + relativa;
}

/**
 * Sube una foto de perfil al backend (POST /usuarios/foto) y actualiza la
 * sesión local + todos los avatares de la página (header, sidebar) llamando
 * a actualizarInterfazUsuario() de core.js, si está disponible.
 *
 * Lanza un Error con un mensaje claro y específico si algo falla (incluyendo
 * el caso más común: el backend no está corriendo), para que cada página
 * lo muestre en su propio toast.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
async function subirFotoUsuario(file) {
    if (!file) throw new Error('No se seleccionó ningún archivo.');
    if (!file.type || !file.type.startsWith('image/'))
        throw new Error('El archivo debe ser una imagen (JPG, PNG, GIF o WEBP).');
    if (file.size > 8 * 1024 * 1024)
        throw new Error('La imagen no debe superar 8 MB.');

    const fd = new FormData();
    fd.append('foto', file);

    let r;
    try {
        r = await fetch(`${API_BASE}/usuarios/foto`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: fd
        });
    } catch (e) {
        console.error('subirFotoUsuario: no se pudo contactar al servidor →', e);
        throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté corriendo en el puerto 8080.');
    }

    if (r.status === 401) {
        cerrarSesion();
        throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
    }

    if (!r.ok) {
        let mensaje = `No se pudo subir la foto (HTTP ${r.status}).`;
        try {
            const err = await r.json();
            if (err?.mensaje) mensaje = err.mensaje;
        } catch {
            try {
                const txt = await r.text();
                if (txt) console.error('subirFotoUsuario: respuesta no-JSON del servidor →', txt);
            } catch { }
        }
        throw new Error(mensaje);
    }

    const data = await r.json();
    const s = getSession();
    s.fotoUrl = data.url;
    localStorage.setItem('userSession', JSON.stringify(s));
    if (typeof actualizarInterfazUsuario === 'function') actualizarInterfazUsuario();
    return data.url;
}


/* -----------------------------------------------------------------------------
   DESCARGA DE ARCHIVOS (PDF / Excel)
----------------------------------------------------------------------------- */

/**
 * Descarga un archivo generado por el backend.
 * @param {string} endpoint      Ruta del recurso, ej: '/exportar/pdf'
 * @param {string} nombreArchivo Nombre con el que se guardará el archivo
 */
async function descargarArchivo(endpoint, nombreArchivo) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (!response.ok) return;

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error descargando archivo:', err);
    }
}


/* -----------------------------------------------------------------------------
   WEBSOCKET — NOTIFICACIONES EN TIEMPO REAL
----------------------------------------------------------------------------- */

/**
 * Conecta al servidor via STOMP/SockJS y escucha notificaciones del usuario.
 * Requiere sockjs-client y stomp.js en el HTML.
 */
function conectarWebSocket() {
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') return;
    const session = getSession();
    if (!session.email) return;

    const socket = new SockJS('http://localhost:8080/ws');
    const client = Stomp.over(socket);
    client.debug = () => { };

    client.connect({ 'Authorization': `Bearer ${getToken()}` }, () => {
        client.subscribe('/user/queue/notificaciones', (msg) => {
            const notif = JSON.parse(msg.body);
            if (typeof mostrarToast === 'function')
                mostrarToast(`${notif.titulo}: ${notif.mensaje}`, 'info');
            const badge = document.querySelector('.notif-badge');
            if (badge) {
                badge.style.display = 'flex';
                badge.textContent = parseInt(badge.textContent || '0') + 1;
            }
        });
    });
}

/** Carga el conteo de notificaciones no leídas y actualiza el badge. */
async function cargarBadgeNotificaciones() {
    try {
        const res = await apiFetch('/notificaciones/no-leidas');
        if (!res?.ok) return;
        const data = await res.json();
        const badge = document.querySelector('.notif-badge');
        if (badge && data.total > 0) {
            badge.style.display = 'flex';
            badge.textContent = data.total;
        }
    } catch { /* Silencioso */ }
}
