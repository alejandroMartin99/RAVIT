from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.aircraft.router import router as aircraft_router
from app.catalog.router import router as catalog_router
from app.core.config import settings
from app.rdg.connect_to_access.router import router as rdg_access_router
from app.rdg.source_ingestion.apc.router import router as rdg_apc_router
from app.rdg.source_ingestion.pd.router import router as rdg_pd_router
from app.rdp.plan_data.pd.router import router as rdp_pd_router

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(catalog_router)
app.include_router(aircraft_router)
app.include_router(rdg_pd_router)
app.include_router(rdp_pd_router)
app.include_router(rdg_apc_router)
app.include_router(rdg_access_router)
