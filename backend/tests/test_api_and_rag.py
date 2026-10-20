"""Integration tests for FastAPI endpoints, Ingestion pipeline, and Graph-RAG querying."""
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ingestion_service import ingestion_manager
from app.services.neo4j_service import neo4j_service

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["services"]["chromadb"] == "connected"
    assert data["services"]["neo4j"] == "connected"
    assert data["services"]["llm_api"] == "ready"

def test_repo_connect_and_ingestion():
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dummy_test_repo"))
    
    # 1. Connect
    payload = {
        "absolute_path": repo_path,
        "languages": ["python", "cpp"],
        "exclude_folders": ["node_modules", "venv", ".git"]
    }
    res = client.post("/api/repo/connect", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    session_id = data["session_id"]
    assert session_id.startswith("req-")
    assert data["valid_files_count"] >= 3

    # 2. Run ingestion stream
    import asyncio
    events = []
    async def collect_events():
        async for event in ingestion_manager.run_ingestion_stream(session_id):
            events.append(event)

    asyncio.run(collect_events())

    stages = [e["stage"] for e in events]
    assert "AST_PARSING" in stages
    assert "GRAPH_MAPPING" in stages
    assert "VECTOR_EMBEDDING" in stages
    assert "COMPLETE" in stages

    # 3. Verify Neo4j has nodes
    driver = neo4j_service.get_driver()
    with driver.session() as session:
        classes_count = session.run("MATCH (c:Class) RETURN count(c) as cnt").single()["cnt"]
        assert classes_count >= 3, f"Expected at least 3 classes in Neo4j, got {classes_count}"

def test_chat_query_execution():
    # Test real LLM execution with the newly indexed dummy repo
    res = client.post("/api/chat/query", json={"query": "Where is the user authentication logic located?"})
    assert res.status_code == 200
    data = res.json()
    assert "response_text" in data
    assert len(data["response_text"]) > 10
    # Should contain file pills like auth.py or AuthManager
    assert "file_pills" in data
    assert "snippets" in data
    assert "graph_data" in data

def test_empty_context_guardrail():
    # Test query completely unrelated to the dummy codebase
    res = client.post("/api/chat/query", json={"query": "How do I configure Stripe PaymentGateway?"})
    assert res.status_code == 200
    data = res.json()
    # Guardrail check
    text = data["response_text"]
    assert "PaymentGateway" in text or "cannot find this information" in text or "scanned the indexed repository" in text
