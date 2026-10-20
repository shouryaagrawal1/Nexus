"""FastAPI application entrypoint for Project Nexus."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.neo4j_service import neo4j_service
from app.routers import repo, chat, graph, health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nexus.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure Neo4j constraints exist
    logger.info("Initializing Neo4j schema constraints & indexes...")
    try:
        neo4j_service.init_constraints_and_indexes()
        logger.info("Neo4j initialization complete.")
    except Exception as e:
        logger.warning(f"Could not initialize Neo4j constraints on startup: {e}")
    yield
    # Shutdown
    neo4j_service.close()

app = FastAPI(
    title="Project Nexus - Codebase Intelligence API",
    description="Dual-engine Graph-RAG system for codebase exploration and architecture visualization.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration as specified in Section 1
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handler for Standardized Error Schema
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        error_type = detail.get("error", "HTTPError")
        message = detail.get("message", str(detail))
    else:
        error_type = "HTTPError"
        message = str(detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": error_type,
            "message": message,
            "status_code": exc.status_code
        }
    )

# Include Routers
app.include_router(repo.router)
app.include_router(chat.router)
app.include_router(graph.router)
app.include_router(health.router)

@app.get("/")
async def root():
    return {
        "name": "Project Nexus API",
        "status": "online",
        "docs_url": "/docs"
    }
