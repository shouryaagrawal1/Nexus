"""Anti-hallucination validation and ground-truth comparison test suite (QA Spec Section 3)."""
import os
import re
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.parser import code_parser
from app.services.ingestion_service import ingestion_manager

client = TestClient(app)

DUMMY_REPO_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dummy_test_repo"))

@pytest.fixture(scope="module", autouse=True)
def ensure_dummy_repo_indexed():
    """Ensures dummy_test_repo is ingested before running QA anti-hallucination tests."""
    connect_payload = {
        "absolute_path": DUMMY_REPO_PATH,
        "languages": ["python", "cpp"],
        "exclude_folders": ["node_modules", "venv", ".git"]
    }
    res = client.post("/api/repo/connect", json=connect_payload)
    assert res.status_code == 200, f"Connect failed: {res.text}"
    session_id = res.json()["session_id"]

    import asyncio
    async def run_ingest():
        async for _ in ingestion_manager.run_ingestion_stream(session_id):
            pass
    asyncio.run(run_ingest())


def get_all_ground_truth_symbols(repo_path: str):
    """Collects all real file names, class names, and function names from the repository."""
    symbols = set()
    files = list(code_parser.discover_files(repo_path))
    for f in files:
        symbols.add(os.path.basename(f))
        symbols.add(os.path.relpath(f, repo_path).replace("\\", "/"))
        ast_data = code_parser.parse_file(f, repo_path)
        for c in ast_data.get("classes", []):
            symbols.add(c["label"])
        for fn in ast_data.get("functions", []):
            symbols.add(fn["label"])
    return symbols


def test_pill_syntax_ground_truth():
    """Rule 1 & 2: Pill Syntax Verification against ground truth symbols."""
    ground_truth = get_all_ground_truth_symbols(DUMMY_REPO_PATH)

    res = client.post("/api/chat/query", json={"query": "Where is the user authentication logic located?"})
    assert res.status_code == 200
    data = res.json()
    response_text = data["response_text"]

    # Extract all pills matching [[Entity]]
    matched_pills = re.findall(r"\[\[(.*?)\]\]", response_text)
    assert len(matched_pills) > 0, f"Expected at least one [[pill]] in response, got none. Text: {response_text}"

    for pill in matched_pills:
        # Check if pill name matches any real file, class, or function in the dummy repo
        pill_clean = pill.strip()
        is_valid = (
            pill_clean in ground_truth or
            any(pill_clean.lower() in sym.lower() for sym in ground_truth) or
            pill_clean.replace("()", "") in ground_truth
        )
        assert is_valid, f"Hallucinated pill entity detected: '[[{pill_clean}]]' not in ground truth symbols: {ground_truth}"


def test_code_snippet_ground_truth():
    """Rule 3: Code Snippet Verification against actual source code files."""
    res = client.post("/api/chat/query", json={"query": "Show me the definition of User class and login method."})
    assert res.status_code == 200
    data = res.json()
    snippets = data.get("snippets", [])

    # Read all raw code files in dummy repo into memory
    repo_contents = {}
    for root, _, files in os.walk(DUMMY_REPO_PATH):
        for file in files:
            p = os.path.join(root, file)
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                repo_contents[file] = f.read()

    # If snippets were returned in the structured response
    for s in snippets:
        rel_file = os.path.basename(s["file_path"])
        assert rel_file in repo_contents, f"Snippet references unknown file: {rel_file}"
        file_text = repo_contents[rel_file]
        # Verify that snippet code lines actually exist in the file
        snippet_lines = [l.strip() for l in s["code"].strip().split("\n") if l.strip()]
        for line in snippet_lines:
            assert line in file_text, f"Hallucinated line '{line}' not found in {rel_file}"


def test_fallback_trigger_unrelated_queries():
    """Edge Case 2 / Section 3.3: Strict guardrail refusal for queries outside the codebase."""
    unrelated_queries = [
        "How do I bake a chocolate cake?",
        "Write a Python script to scrape Twitter for stock prices."
    ]

    for q in unrelated_queries:
        res = client.post("/api/chat/query", json={"query": q})
        assert res.status_code == 200
        text = res.json()["response_text"]
        
        refusal_matched = (
            "cannot find this information" in text or
            "scanned the indexed repository" in text or
            "restricted to analyzing the currently indexed" in text
        )
        assert refusal_matched, f"Expected guardrail refusal for '{q}', but received: {text}"


def test_blast_radius_dependency_awareness():
    """Rule 4: Explicit dependency warning about blast radius when modifying functions."""
    res = client.post("/api/chat/query", json={
        "query": "If I modify retryConnection in BaseDBWorker, what other components will be affected?"
    })
    assert res.status_code == 200
    data = res.json()
    text = data["response_text"]

    # Must warn or mention callers/dependencies (like execute, AbstractWorker, or logError)
    assert any(sym in text for sym in ["execute", "logError", "AbstractWorker", "BaseDBWorker", "Blast Radius", "CALLS"]), \
        f"Expected blast radius or dependency awareness in response, got: {text}"
