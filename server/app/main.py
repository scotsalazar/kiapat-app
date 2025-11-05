"""
Entrypoint for the Kiapat inventory backend.  Creates the FastAPI
application, includes routers and configures CORS.  When run directly
this module will start a Uvicorn server for local development.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import auth as auth_router
from .routers import catalog as catalog_router
from .routers import inventory as inventory_router
from .routers import sales as sales_router
from .routers import admin as admin_router
from . import seeder
from .database import SessionLocal


def create_app() -> FastAPI:
    # Create all tables if they don't exist
    models.Base.metadata.create_all(bind=engine)
    app = FastAPI(title="Kiapat Inventory & Sales API")
    # CORS configuration
    origins = []
    # allow environment-specified origins
    import os

    frontend_origins = os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    for origin in frontend_origins:
        if origin:
            origins.append(origin.strip())
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Include routers
    app.include_router(auth_router.router)
    app.include_router(catalog_router.router)
    app.include_router(inventory_router.router)
    app.include_router(sales_router.router)
    app.include_router(admin_router.router)
    # Automatically seed database on startup if empty
    @app.on_event("startup")
    def seed_on_startup() -> None:
        # Create initial data if no users exist
        with SessionLocal() as db:
            seeder.seed_database(db)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    import os

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True
    )