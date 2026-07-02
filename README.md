# Bankomunal

Sistema web de gestión de microfinanzas comunitarias (bankomunal). Permite a un grupo de socios registrarse, administrar cuentas y ahorros, solicitar y pagar préstamos, organizar su vida comunitaria (grupos, publicaciones, eventos, encuestas), acceder a educación financiera y recibir soporte técnico, todo desde una sola plataforma.

---

## Tabla de contenido

- [Tecnologías utilizadas](#-tecnologías-utilizadas)
- [Arquitectura](#-arquitectura)
- [Estructura del repositorio](#-estructura-del-repositorio)
- [Requisitos previos](#-requisitos-previos)
- [Instalación y ejecución](#-instalación-y-ejecución)
- [Usuarios de prueba](#-usuarios-de-prueba)
- [Funcionalidades principales](#-funcionalidades-principales)
- [Autor](#-autor)
- [Licencia](#-licencia)

---

## Tecnologías utilizadas

**Backend**
- Java 21
- Spring Boot
- Spring Security (autenticación basada en JWT)
- Spring Data JPA / Hibernate
- Apache POI (exportación de reportes a Excel)
- Maven

**Frontend**
- HTML5
- CSS3
- JavaScript (ES6), sin frameworks adicionales
- Consumo de API REST vía `fetch`

**Base de datos**
- MySQL 8.x

---

## Arquitectura

El sistema sigue una arquitectura cliente-servidor desacoplada:

```
┌─────────────────┐        HTTP / JSON         ┌──────────────────┐        JPA / SQL        ┌──────────────┐
│   Frontend       │  ───────────────────────►  │     Backend       │  ───────────────────►  │   MySQL       │
│ HTML + CSS + JS   │  ◄───────────────────────  │ Spring Boot (API) │  ◄───────────────────  │  bankomunal   │
└─────────────────┘        REST (/api/**)        └──────────────────┘                         └──────────────┘
```

La autenticación se maneja mediante **JSON Web Tokens (JWT)**: el backend emite un token al iniciar sesión y el frontend lo envía en cada petición protegida mediante el encabezado `Authorization`.

---

## Estructura del repositorio

```
bankomunal/
├── backend/                   # API REST en Spring Boot
│   ├── src/
│   │   └── main/
│   │       ├── java/com/bankomunal/
│   │       │   ├── controller/    # Endpoints REST
│   │       │   ├── service/       # Lógica de negocio
│   │       │   ├── entity/        # Entidades JPA
│   │       │   ├── repository/    # Repositorios Spring Data
│   │       │   ├── dto/           # DTOs de request/response
│   │       │   └── config/        # Seguridad, JWT, datos iniciales
│   │       └── resources/
│   │           └── application.properties
│   └── pom.xml
│
├── frontend/                  # Interfaz web (HTML/CSS/JS)
│   ├── pages/                 # Vistas internas (préstamos, comunidad, etc.)
│   ├── js/                    # Lógica de cliente y consumo de la API
│   ├── login.html
│   ├── registro.html
│   └── ...
│
├── database/
│   └── bankomunal.sql         # Script de creación del esquema (45+ tablas)
│
├── .gitignore
└── README.md
```

---

## Requisitos previos

- [Java JDK 21](https://adoptium.net/)
- [Maven 3.9+](https://maven.apache.org/) (o usar el wrapper `mvnw` si está incluido)
- [MySQL 8.x](https://dev.mysql.com/downloads/) en ejecución localmente
- Un navegador web actualizado (Chrome, Edge, Firefox)
- (Opcional) Extensión **Live Server** de VS Code para servir el frontend

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/<tu-usuario>/bankomunal.git
cd bankomunal
```

### 2. Crear la base de datos

Crear la base de datos en MySQL e importar el script:

```bash
mysql -u root -p -e "CREATE DATABASE bankomunal CHARACTER SET utf8mb4;"
mysql -u root -p bankomunal < database/bankomunal.sql
```

### 3. Configurar la conexión del backend

Editar `backend/src/main/resources/application.properties` y ajustar usuario y contraseña de tu MySQL local:

```properties
server.port=8080
spring.datasource.url=jdbc:mysql://localhost:3306/bankomunal?useSSL=false&serverTimezone=America/Bogota&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=TU_CONTRASEÑA_AQUI
```

### 4. Ejecutar el backend

```bash
cd backend
mvn spring-boot:run
```

El backend quedará disponible en **`http://localhost:8080`**, con la API expuesta bajo el prefijo `/api`.

> En el primer arranque, el sistema crea automáticamente roles y usuarios de prueba (ver sección siguiente) mediante `DataInitializer.java`.

### 5. Ejecutar el frontend

El frontend es un sitio estático, no requiere build. Opciones:

- **Con Live Server (recomendado):** abrir la carpeta `frontend/` en VS Code, clic derecho sobre `login.html` → "Open with Live Server".
- **Directamente en el navegador:** abrir el archivo `frontend/login.html` desde el explorador de archivos.

### 6. Iniciar sesión

Usar cualquiera de los usuarios de prueba listados abajo, o registrarte como nuevo socio desde `registro.html`.
---

## Usuarios de prueba

Generados automáticamente en el primer arranque del backend:

| Correo | Contraseña | Rol | Saldo inicial |
|---|---|---|---|
| `admin@bankomunal.com` | `Admin2026*` | Administrador | $0 |
| `carlos@test.com` | `Carlos2026*` | Socio | $500.000 COP |
| `laura@test.com` | `Laura2026*` | Socio | $250.000 COP |
| `pedro@test.com` | `Pedro2026*` | Socio | $450.000 COP |

---

## Funcionalidades principales

- **Autenticación y registro:** registro de socios, login con JWT, bloqueo por intentos fallidos, recuperación de contraseña.
- **Perfil y seguridad:** edición de datos personales, foto de perfil, cambio de contraseña, cierre de sesiones activas.
- **Cuentas y transferencias:** consulta de saldo, transferencias entre socios, pago de servicios, historial de movimientos.
- **Préstamos:** simulador de crédito, solicitud, aprobación/rechazo (admin), tabla de amortización, pago de cuotas.
- **Comunidad:** creación de grupos de ahorro, fondo común, muro de publicaciones, eventos y reuniones.
- **Encuestas:** creación y votación de encuestas, votaciones de cambio de reglamento con umbral de aprobación.
- **Educación financiera:** cursos con seguimiento de avance y emisión de certificados.
- **Beneficios:** programa de puntos por pago de cuotas, canje de beneficios.
- **Salud financiera:** panel de indicadores (puntaje, nivel, capacidad de pago, deuda activa).
- **Soporte técnico y documentos:** tickets de soporte, gestión de documentos personales con control de versiones.
- **Administración:** gestión de usuarios y roles, reportes financieros, auditoría con exportación a Excel.

---

## Autor

** Wendy Hyashley Duarte Contreras **
Tecnología en Análisis y Desarrollo de Software (ADSO) — SENA

---

## Licencia

Proyecto desarrollado.
