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

## Notas

- `DATABASE_URL` en `Backend/.env` queda preparado para SQLAlchemy/pyodbc. El ORM no está conectado en este corte.
- Password SA de desarrollo: `RavitLocal2026!` (cámbiala si expones el puerto).
