"""Foundation tests for Phase 1 and Phase 2 validation."""
import os
import pytest
from app.services.parser import code_parser
from app.services.neo4j_service import neo4j_service

def test_ast_parser_dummy_repo():
    repo_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dummy_test_repo"))
    files = list(code_parser.discover_files(repo_path))
    assert len(files) >= 3, f"Expected at least 3 files, found {len(files)}"

    parsed_files = {}
    for f in files:
        res = code_parser.parse_file(f, repo_path)
        rel = res["file"]["file_path"]
        parsed_files[rel] = res

    # Check auth.py
    assert "auth.py" in parsed_files
    auth_data = parsed_files["auth.py"]
    class_names = [c["label"] for c in auth_data["classes"]]
    assert "User" in class_names
    assert "Admin" in class_names
    assert "AuthManager" in class_names

    # Check inheritance edge in auth.py (Admin -> User)
    inheritance_edges = [e for e in auth_data["edges"] if e["relationship_type"] == "INHERITS_FROM"]
    assert len(inheritance_edges) >= 1
    assert any(e["target_name"] == "User" for e in inheritance_edges)

    # Check worker.cpp
    assert "worker.cpp" in parsed_files
    worker_cpp = parsed_files["worker.cpp"]
    cpp_classes = [c["label"] for c in worker_cpp["classes"]]
    assert "AbstractWorker" in cpp_classes
    assert "BaseDBWorker" in cpp_classes

def test_neo4j_connection():
    healthy = neo4j_service.check_health()
    assert healthy is True, "Neo4j container should be healthy and responding to queries"

def test_chromadb_insertion():
    from app.services.chroma_service import chroma_service
    assert chroma_service.check_health() is True

    # Test adding mock chunks
    mock_chunks = [
        {
            "id": f"mock_chunk_{i}",
            "document": f"def test_func_{i}(): pass",
            "metadata": {"neo4j_node_id": f"mock_node_{i}", "type": "Function"}
        }
        for i in range(5)
    ]
    chroma_service.batch_add_chunks(mock_chunks)
    res = chroma_service.query_similar("test_func_0", n_results=1)
    assert len(res) >= 1
    assert "mock_node" in res[0]["metadata"]["neo4j_node_id"]
