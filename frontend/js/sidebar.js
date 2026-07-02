/**
 * =============================================================================
 * Genera el sidebar y actualiza header dinámicamente.
 * =============================================================================
 */

(function () {

    const MENU = [
        { href: 'dashboard.html',              icon: 'fa-house',                 label: 'Inicio' },
        { separator: true },
        { label: 'FINANZAS', group: true },
        { href: 'cuentas.html',                icon: 'fa-wallet',                label: 'Mi Cuenta',         socioOnly: true },
        { href: 'transferencias.html',         icon: 'fa-money-bill-transfer',   label: 'Transferencias',      socioOnly: true },
        { href: 'pagos.html',                  icon: 'fa-receipt',               label: 'Pagar Servicios',     socioOnly: true },
        { href: 'tarjetavirtual.html',         icon: 'fa-credit-card',           label: 'Tarjeta Virtual',     socioOnly: true },
        { separator: true },
        { label: 'CRÉDITOS', group: true },
        { href: 'prestamos.html',              icon: 'fa-hand-holding-dollar',   label: 'Préstamos',           socioOnly: true },
        { href: 'simulador-credito.html',      icon: 'fa-calculator',            label: 'Simulador' },
        { separator: true },
        { label: 'MIS DATOS', group: true },
        { href: 'historial.html',              icon: 'fa-clock-rotate-left',     label: 'Historial',           socioOnly: true },
        { href: 'salud-financiera.html',       icon: 'fa-chart-pie',             label: 'Salud Financiera',    socioOnly: true },
        { href: 'comunidad.html',              icon: 'fa-users',                 label: 'Mi Comunidad' },
        { href: 'encuestas.html',              icon: 'fa-square-poll-horizontal',label: 'Encuestas y Votos' },
        { href: 'documentos.html',             icon: 'fa-folder-open',           label: 'Mis Documentos' },
        { href: 'educacion.html',              icon: 'fa-graduation-cap',        label: 'Educación Financiera' },
        { href: 'notificaciones.html',         icon: 'fa-bell',                  label: 'Notificaciones' },
        { href: 'beneficios.html',             icon: 'fa-gift',                  label: 'Beneficios' },
        { separator: true },
        { label: 'SOPORTE', group: true },
        { href: 'soporte-tecnico.html',        icon: 'fa-headset',               label: 'Soporte Técnico' },
        { href: 'ayuda.html',                  icon: 'fa-circle-question',       label: 'Centro de Ayuda' },
        { separator: true },
        { label: 'CUENTA', group: true },
        { href: 'perfil.html',                 icon: 'fa-user-circle',           label: 'Mi Perfil' },
        { href: 'configuracion.html',          icon: 'fa-gear',                  label: 'Ajustes' },
        { href: 'seguridad.html',              icon: 'fa-shield-halved',          label: 'Seguridad' },
        { separator: true, adminOnly: true },
        { label: 'ADMINISTRACIÓN', group: true, adminOnly: true },
        { href: 'usuarios.html',               icon: 'fa-users-gear',            label: 'Gestión Usuarios',    adminOnly: true },
        { href: 'gestion-prestamos.html',      icon: 'fa-hand-holding-dollar',   label: 'Gestión Préstamos',   adminOnly: true },
        { href: 'reportes-financieros.html',   icon: 'fa-file-invoice-dollar',   label: 'Reportes BI',         adminOnly: true },
        { href: 'auditoria.html',              icon: 'fa-magnifying-glass-chart',label: 'Auditoría',            adminOnly: true },
        { href: 'roles-permisos.html',         icon: 'fa-shield-halved',         label: 'Roles y Permisos',    adminOnly: true },
        { href: 'respaldo-recuperacion.html',  icon: 'fa-database',              label: 'Respaldo',             adminOnly: true },
    ];

    /* Vista actual para el admin: 'admin' (default) | 'socio' */
    function getVistaAdmin() {
        return localStorage.getItem('adminVista') || 'admin';
    }
    function setVistaAdmin(v) {
        localStorage.setItem('adminVista', v);
    }

    function injectSidebarHTML() {
        const aside = document.querySelector('.sidebar');
        if (!aside) return;
        aside.innerHTML = `
            <div class="brand-container">
                <img src="../assets/img/logo.png" alt="Bankomunal" class="sidebar-logo">
                <div class="brand-text">
                    <strong>BANKOMUNAL</strong>
                    <span class="subtitle">Microfinanzas Comunitarias</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <ul class="nav-menu" id="sidebarMenu"></ul>
            </nav>
            <div class="sidebar-footer"><small>ayuda@bankomunal.org</small></div>
        `;
    }

    function buildMenu() {
        const ul = document.getElementById('sidebarMenu');
        if (!ul) return;

        const session     = JSON.parse(localStorage.getItem('userSession') || '{}');
        const rol         = (session.rol || 'socio').toLowerCase();
        const esAdmin     = rol === 'admin';
        const vistaAdmin  = getVistaAdmin(); // 'admin' | 'socio'
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        document.body.setAttribute('data-role', rol);

        MENU.forEach(item => {
            /* Ocultar items exclusivos de admin a socios */
            if (item.adminOnly && !esAdmin) return;

            /* En vista admin: ocultar items socioOnly para mantener el sidebar limpio */
            if (item.socioOnly && esAdmin && vistaAdmin === 'admin') return;

            /* Separadores y grupos: solo mostrar si hay items visibles en esa sección */
            if (item.separator) {
                const li = document.createElement('li');
                li.className = 'nav-separator';
                ul.appendChild(li);
                return;
            }
            if (item.group) {
                const li = document.createElement('li');
                li.className = 'nav-group-label';
                li.innerHTML = `<span>${item.label}</span>`;
                ul.appendChild(li);
                return;
            }

            const isActive = currentPage === item.href;
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="${item.href}" class="nav-link${isActive ? ' active' : ''}">
                    <i class="fa-solid ${item.icon}"></i>
                    <span>${item.label}</span>
                </a>`;
            ul.appendChild(li);
        });

        /* Toggle de vista para admin */
        if (esAdmin) {
            const sepToggle = document.createElement('li');
            sepToggle.className = 'nav-separator';
            ul.appendChild(sepToggle);

            const liToggle = document.createElement('li');
            const esSocioVista = vistaAdmin === 'socio';
            liToggle.innerHTML = `
                <button id="btnVistaToggle" class="nav-link nav-link-toggle" title="${esSocioVista ? 'Volver a vista Admin' : 'Ver páginas de Socio'}" style="width:100%;background:none;border:none;cursor:pointer;text-align:left;">
                    <i class="fa-solid ${esSocioVista ? 'fa-shield-halved' : 'fa-user'}"></i>
                    <span>${esSocioVista ? 'Vista Admin' : 'Vista Socio'}</span>
                </button>`;
            ul.appendChild(liToggle);

            document.getElementById('btnVistaToggle')?.addEventListener('click', () => {
                const nueva = vistaAdmin === 'admin' ? 'socio' : 'admin';
                setVistaAdmin(nueva);
                /* Reconstruir el menú en caliente */
                ul.innerHTML = '';
                buildMenu();
            });
        }

        /* Logout */
        const sep = document.createElement('li'); sep.className = 'nav-separator';
        ul.appendChild(sep);
        const liL = document.createElement('li');
        liL.innerHTML = `<a href="#" id="logoutBtn" class="nav-link logout"><i class="fa-solid fa-right-from-bracket"></i><span>Cerrar Sesión</span></a>`;
        ul.appendChild(liL);
    }

    function updateUserUI() {
        const session = JSON.parse(localStorage.getItem('userSession') || '{}');
        const nameEl   = document.getElementById('nombreUsuario');
        const roleEl   = document.getElementById('rolUsuario');
        const avatarEl = document.getElementById('avatarUsuario');
        if (nameEl  && session.nombre)  nameEl.textContent  = session.nombre;
        if (roleEl  && session.rol)     roleEl.textContent  = session.rol;
        if (avatarEl) {
            if (session.fotoUrl) {

                const rel = (typeof normalizarFotoUrlRelativa === 'function')
                    ? normalizarFotoUrlRelativa(session.fotoUrl)
                    : (session.fotoUrl.startsWith('/') ? session.fotoUrl : '/' + session.fotoUrl);
                const urlAbs = rel.startsWith('http') || rel.startsWith('data:')
                    ? rel
                    : 'http://localhost:8080' + rel;
                avatarEl.style.backgroundImage    = `url(${urlAbs})`;
                avatarEl.style.backgroundSize     = 'cover';
                avatarEl.style.backgroundPosition = 'center';
                avatarEl.textContent = '';
            } else if (session.iniciales) {
                avatarEl.textContent = session.iniciales;
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectSidebarHTML();
        buildMenu();
        updateUserUI();
    });
})();
