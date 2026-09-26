from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import aircraft, apc, catalog, pd
from app.core.config import settings

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


app.include_router(catalog.router)
app.include_router(aircraft.router)
app.include_router(pd.router)
app.include_router(apc.router)
