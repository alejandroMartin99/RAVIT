# RAVIT

MVP de mantenimiento (estilo SAP PM). Front Angular 18, API FastAPI/uvicorn, SQL Server 2022 en Docker.

## Arranque local

Tres procesos. Copia los `.env` antes del primero:

```bash
copy .env.example .env
copy Backend\.env.example Backend\.env
```

### 1. SQL Server

Requiere Docker Desktop.

```bash
docker compose up -d
```

Crea la base `ravit` (sin tablas de negocio todavía). Puerto `1433`.

### 2. API

```bash
cd Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

`http://localhost:8000/health` → `{"status":"ok"}`.

### 3. Front

```bash
cd Frontend
npm start
```

`http://localhost:4200` — panel, órdenes y activos (placeholder). El dashboard pinta el estado de `/health`.

## Dist en el PC de empresa

Sin `ng serve`. El build de producción llama a la API en `http://localhost:8000`, y el backend solo acepta el front en el puerto `4200`. Hacen falta los dos procesos.

### API

Igual que el arranque local, desde `Backend` con el venv activo:

```powershell
uvicorn app.main:app --port 8000
```

`http://localhost:8000/health` tiene que responder `{"status":"ok"}`.

### Front compilado

La salida de `ng build` es `Frontend\dist\ravit\browser`. Si esa carpeta no viene en el repo, generarla una vez (hace falta `npm install` en `Frontend`):

```powershell
cd Frontend
npm run build
```

Servir esa carpeta en el puerto 4200:

```powershell
cd Frontend\dist\ravit\browser
python -m http.server 4200
```

Abrir `http://localhost:4200`. Entrar siempre por esa raíz: este servidor no reescribe rutas internas, así que un refresco en `/aircraft/...` devuelve 404.

Si `npx` está permitido, este comando sí aguanta el refresco en cualquier ruta:

```powershell
cd Frontend
npx --yes serve dist/ravit/browser -l 4200 -s
```

## Notas

- `DATABASE_URL` en `Backend/.env` queda preparado para SQLAlchemy/pyodbc. El ORM no está conectado en este corte.
- Password SA de desarrollo: `RavitLocal2026!` (cámbiala si expones el puerto).
