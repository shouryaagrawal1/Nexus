"""Application configuration loaded from environment variables."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Neo4j Database
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "local_password"

    # ChromaDB Vector Store
    chroma_db_dir: str = "./.chroma_data"

    # Google Gemini API
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"

    # Server Configuration
    host: str = "127.0.0.1"
    port: int = 8000
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
