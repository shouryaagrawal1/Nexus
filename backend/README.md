# Nexus Backend ⚙️

FastAPI-powered asynchronous backend and LangChain Graph-RAG orchestrator for **Project Nexus**.

---

## 🏛️ Service Architecture

```text
backend/app/
├── main.py                  # FastAPI application entrypoint, CORS & error handling
├── config.py                # Pydantic settings loading .env parameters
├── routers/                 # REST & SSE Endpoint Handlers
│   ├── repo.py              # /api/repo/connect, /api/repo/ingest/status, /api/repo/file-content
│   ├── chat.py              # /api/chat/query
│   ├── graph.py             # /api/graph/node-impact/{node_id}, /api/graph/galaxy
│   └── health.py            # /api/health
├── schemas/                 # Pydantic Request & Response Models
│   ├── repo.py              # RepoConnectRequest, RepoConnectResponse
│   ├── chat.py              # QueryRequest, QueryResponse, CodeSnippet
│   └── graph.py             # GraphNode, GraphEdge, ImpactResponse
└── services/                # Core Business Logic Engines
    ├── parser.py            # Memory-safe AST generator via Tree-sitter (Python & C++)
    ├── neo4j_service.py     # Neo4j driver, Cypher UNWIND batching, blast radius queries
    ├── chroma_service.py    # ChromaDB client, AST chunking, embeddings
    ├── ingestion_service.py # Ingestion session manager streaming SSE progress
    └── rag_service.py       # LangChain Graph-RAG orchestrator & Gemini integration
```

---

## 🧠 Core Engineering Principles

1. **Memory Safety via Python Generators**:
   Repositories are parsed file-by-file with Python generators (`yield`). Memory is freed after each file is processed, preventing memory exhaustion on massive codebases.
2. **Deterministic Uniqueness & Batch Writes**:
   All `File`, `Class`, and `Function` nodes use deterministic MD5 hashes for idempotent updates. Writes use Cypher `UNWIND` (1,000 items/batch) in Neo4j and batch vector additions (100 items/batch) in ChromaDB.
3. **Dual-Engine Graph-RAG**:
   When a user queries the system, ChromaDB performs semantic similarity search for raw code chunks while Neo4j traverses 1st and 2nd degree dependency edges (`CALLS`, `INHERITS_FROM`, `DEFINED_IN`). Both contexts are unified and injected into the Master System Prompt.
4. **Zero-Hallucination Guardrails**:
   Temperature is locked to `0.0`. If a requested entity is missing from the indexed codebase, the LLM intercepts or responds with a polite refusal rather than fabricating logic.

---

## 🧪 Testing

Execute the full 11-test suite with pytest:

```bash
.\venv\Scripts\pytest -v
```

- **`tests/test_foundation.py`**: Tree-sitter AST extraction, Neo4j connectivity, and ChromaDB insertion.
- **`tests/test_api_and_rag.py`**: FastAPI endpoints, SSE streaming ingestion, and conversational query execution.
- **`tests/test_llm_hallucination.py`**: Automated anti-hallucination checks comparing extracted `[[pills]]` and snippets against ground truth codebase symbols.
