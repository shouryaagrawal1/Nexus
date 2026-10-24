# Project Nexus 🌌

<div align="center">

![Project Nexus Banner](https://img.shields.io/badge/NEXUS-Codebase%20Intelligence-00f2fe?style=for-the-badge&logo=codewars&logoColor=black)
<br/>
<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React%2019-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Neo4j](https://img.shields.io/badge/Neo4j-008CC1?style=flat-square&logo=neo4j&logoColor=white)](https://neo4j.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Store-ff6600?style=flat-square)](https://www.trychroma.com/)
[![Tree-sitter](https://img.shields.io/badge/Tree--sitter-AST%20Parser-2980b9?style=flat-square)](https://tree-sitter.github.io/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-LangChain%20Orchestrator-8e44ad?style=flat-square&logo=google)](https://ai.google.dev/)
[![Python Tests](https://img.shields.io/badge/Tests-11%20Passed-10b981?style=flat-square&logo=pytest)](https://docs.pytest.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

<p align="center">
  <strong>A local-first, zero-hallucination Codebase Intelligence &amp; Architecture Exploration Engine.</strong><br/>
  Fuses AST Parsing, Graph Databases, Semantic Vector Search, and LLM Orchestration with a stunning 3-pane interactive desktop interface.
</p>

</div>

---

## ⚡ What is Project Nexus?

Large legacy codebases (especially in C++ and Python) are notorious for being difficult to navigate, undocumented, and perilous to refactor. Standard RAG tools split raw source files by arbitrary character counts, destroying scope and context, while naive LLMs guess and hallucinate non-existent files and relationships.

**Project Nexus** solves this by uniting **Structural Graph Theory** with **Semantic Vector Retrieval**:

1. **AST-Aware Chunking (Tree-sitter)**: Instead of arbitrary character splits, Nexus parses exact semantic units (classes, methods, functions, inheritance hierarchies, and call relationships) on a single laptop without memory spikes via Python generators.
2. **Dual-Engine Knowledge Layer**:
   - **Neo4j (Structural Graph)**: Maps relationships (`INHERITS_FROM`, `CALLS`, `DEFINED_IN`, `CONTAINS`) and calculates 1st and 2nd degree **Blast Radii** for refactoring impact analysis.
   - **ChromaDB (Semantic Vector)**: Stores mathematical embeddings cross-referenced directly with Neo4j node IDs.
3. **Graph-RAG Orchestrator (LangChain & Google Gemini)**: Hits both engines simultaneously, assembling a contextual block of raw code snippets and structural dependency paths, strictly grounded by zero-hallucination guardrails.
4. **Desktop IDE Experience**: A split-pane dark-mode dashboard featuring an interactive React Flow canvas with live **Blast Radius** highlighting, real-time SSE ingestion progress, interactive `[[Entity]]` pills, and an in-canvas source code drawer.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph UI ["Frontend (React 19 + Vite + React Flow)"]
        Sidebar["Left Sidebar\n(Workspace & Health Monitors)"]
        Chat["Center Pane\n(Intelligence Chat + Interactive Pills)"]
        Canvas["Right Pane\n(Architecture Canvas & Code Drawer)"]
    end

    subgraph API ["Backend API (FastAPI)"]
        Endpoints["REST API & SSE Stream"]
        Orchestrator["Graph-RAG Orchestration (LangChain)"]
        Parser["AST Parser (Tree-sitter Generator)"]
    end

    subgraph DB ["Dual-Engine Data Layer"]
        Neo4j[("Neo4j Graph DB\n(Files, Classes, Functions, Relationships)")]
        Chroma[("ChromaDB Vector Store\n(AST Chunks + Cross-Referenced IDs)")]
    end

    subgraph AI ["AI Services"]
        Gemini["Google Gemini LLM\n(Configured via .env)"]
    end

    Sidebar -->|1. Connect & Ingest| Endpoints
    Endpoints -->|Stream Ingestion Progress| Parser
    Parser -->|Batch UNWIND Nodes & Edges| Neo4j
    Parser -->|Embed & Store AST Chunks| Chroma
    Chat -->|2. Natural Language Query| Orchestrator
    Orchestrator -->|Vector Similarity Search| Chroma
    Orchestrator -->|Blast Radius Traversal| Neo4j
    Orchestrator -->|Master System Prompt + Ground Truth| Gemini
    Gemini -->|Prose + [[Pills]] + Snippets| Chat
    Chat -->|Canvas Auto-Sync| Canvas
    Canvas -->|3. Single-Click Node: Blast Radius| Endpoints
    Endpoints -->|Fetch 1st & 2nd Degree Impacts| Neo4j
```

---

## ✨ Key Features

### 🌌 3-Pane Desktop IDE Dashboard
- **Left Sidebar (15%)**: Workspace manager with active repository indicator and live polling server health badges for **ChromaDB**, **Neo4j**, and **Gemini LLM API**.
- **Center Chat Pane (45%)**: Streaming codebase intelligence chat. Mentions of files or classes are automatically transformed into clickable, interactive pills (e.g., `[[AuthManager]]`, `[[worker.cpp]]`).
- **Right Architecture Canvas (40%)**: Interactive `@xyflow/react` graph with custom File, Class, and Function nodes.

### 💥 Interactive "Blast Radius" Analysis
- **Single-click any node**: Automatically dims unrelated components and brightly illuminates the node's **Crimson Red Blast Radius** (`#ef4444`), visually answering: *"If I change this function or class, what other components will break?"*
- **Contextual '+' Expander**: A dedicated expand button on every node dynamically queries Neo4j for the next layer of dependencies without reloading the canvas.
- **Double-click any node**: Slides open the **CodeDrawer** to inspect the underlying source code with line numbering and syntax styling without ever leaving the dashboard.

### 🛡️ Zero-Hallucination & Guardrails
- Hardcoded system prompt locks the model temperature to `0.0` for deterministic outputs.
- Any entity not found in the indexed repository triggers an immediate polite refusal: *"I cannot find this information in the indexed codebase."*
- Out-of-scope queries (e.g., *"How do I bake a cake?"* or web scrapers) are caught and rejected to prevent token waste.

### ⚡ Memory-Safe AST Ingestion (Generators)
- Parsing a 500,000-line codebase will not freeze your laptop. Nexus uses Python generators (`yield`) to process one file at a time, clearing RAM before proceeding.
- Writes are committed in high-performance chunks (1,000 nodes/edges via Cypher `UNWIND`, 100 vector chunks in ChromaDB).

---

## 📁 Repository Structure

```text
nexus/
├── docker-compose.yml          # Container configuration for Neo4j Community Edition
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Strict rules excluding secrets, venvs, and local DBs
│
├── backend/                    # FastAPI & LangChain Service
│   ├── requirements.txt        # Backend dependencies
│   ├── pytest.ini              # Pytest configuration
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint & CORS middleware
│   │   ├── config.py           # Pydantic Settings loading .env
│   │   ├── routers/            # API Endpoints
│   │   │   ├── repo.py         # /api/repo/connect, /api/repo/ingest/status (SSE), /api/repo/file-content
│   │   │   ├── chat.py         # /api/chat/query
│   │   │   ├── graph.py        # /api/graph/node-impact/{node_id}, /api/graph/galaxy
│   │   │   └── health.py       # /api/health
│   │   ├── schemas/            # Pydantic request & response models
│   │   │   ├── repo.py
│   │   │   ├── chat.py
│   │   │   └── graph.py
│   │   └── services/           # Core Engine Services
│   │       ├── parser.py       # Tree-sitter AST generator (Python & C++)
│   │       ├── neo4j_service.py# Batch Cypher UNWIND, uniqueness constraints, blast radius
│   │       ├── chroma_service.py # Vector store, AST chunking, cross-referenced metadata
│   │       ├── ingestion_service.py # Real-time SSE orchestrator
│   │       └── rag_service.py  # LangChain Graph-RAG orchestrator & Gemini integration
│   └── tests/                  # Automated QA Test Suite (11/11 passing)
│       ├── test_foundation.py  # AST parser & database connectivity
│       ├── test_api_and_rag.py # REST endpoints & Graph-RAG pipeline
│       └── test_llm_hallucination.py # Anti-hallucination ground truth tests
│
├── frontend/                   # React 19 + Vite + React Flow Application
│   ├── package.json
│   ├── vite.config.js          # Vite config with /api proxy to backend
│   ├── index.html              # Custom fonts (Inter & JetBrains Mono)
│   └── src/
│       ├── index.css           # Modern IDE dark-mode design system & tokens
│       ├── App.jsx             # 3-pane split layout container
│       ├── components/
│       │   ├── Sidebar.jsx     # Workspace manager & server health status
│       │   ├── ConnectModal.jsx# Index Local Workspace modal with 3 SSE progress bars
│       │   ├── ChatPane.jsx    # Intelligence Chat with [[Entity]] pill renderer
│       │   ├── CanvasPane.jsx  # React Flow architecture graph with Blast Radius
│       │   ├── CodeDrawer.jsx  # Sliding code inspection drawer
│       │   └── FilePill.jsx    # Clickable interactive entity pill
│       ├── hooks/
│       │   └── useHealth.js    # 10s health check polling hook
│       └── services/
│           └── api.js          # REST & SSE communication client
│
└── dummy_test_repo/            # Controlled test suite repository
    ├── auth.py                 # Python classes, inheritance, and auth methods
    ├── worker.py               # Worker classes, timeout logic, and inheritance
    └── worker.cpp              # C++ AbstractWorker, BaseDBWorker, and error logging
```

---

## 🚀 Quickstart Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Neo4j)
- Python 3.11+
- Node.js 18+ & npm

### 1. Clone the Repository
```bash
git clone https://github.com/shouryaagrawal1/Nexus.git
cd Nexus
```

### 2. Configure Environment Variables
Copy the template and add your Google Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=local_password
CHROMA_DB_DIR=./.chroma_data
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
HOST=127.0.0.1
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173
```
*(Your `.env` file is excluded in `.gitignore` to prevent secret leakage).*

### 3. Spin Up Neo4j via Docker
```bash
docker compose up -d
```
Neo4j Browser will be available at [http://localhost:7474](http://localhost:7474).

### 4. Setup & Launch the Backend
```bash
cd backend
python -m venv venv

# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
FastAPI Swagger documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 5. Setup & Launch the Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser!

---

## 🧪 Testing & Quality Assurance

Project Nexus includes a comprehensive 11-test suite validating the entire pipeline from Tree-sitter AST extraction to Gemini anti-hallucination checks:

```bash
cd backend
.\venv\Scripts\pytest -v
```

### Included Tests:
1. **`test_foundation.py`**:
   - `test_ast_parser_dummy_repo`: Verifies AST extraction for Python & C++ inheritance and calls.
   - `test_neo4j_connection`: Validates Cypher connectivity and index constraints.
   - `test_chromadb_insertion`: Checks cosine vector storage and metadata retrieval.
2. **`test_api_and_rag.py`**:
   - `test_health_endpoint`: Tests `/api/health` polling.
   - `test_repo_connect_and_ingestion`: Tests the SSE streaming pipeline and node count verification.
   - `test_chat_query_execution`: Validates Gemini Graph-RAG end-to-end execution.
   - `test_empty_context_guardrail`: Tests graceful handling of out-of-context requests.
3. **`test_llm_hallucination.py`**:
   - `test_pill_syntax_ground_truth`: Regex-matches all `[[Entity]]` pills and asserts they exist in the repository.
   - `test_code_snippet_ground_truth`: Performs exact substring matching of LLM snippets against local raw files.
   - `test_fallback_trigger_unrelated_queries`: Asserts refusal for unrelated topics (e.g., cake baking, web scraping).
   - `test_blast_radius_dependency_awareness`: Asserts caller/callee warning when asking about modifying core functions.

---

## 🔌 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status for ChromaDB, Neo4j, and Gemini LLM. |
| `POST` | `/api/repo/connect` | Validates directory path and returns session ID + valid file count. |
| `GET` | `/api/repo/ingest/status` | SSE endpoint streaming real-time progress (`AST_PARSING`, `GRAPH_MAPPING`, `VECTOR_EMBEDDING`, `COMPLETE`). |
| `GET` | `/api/repo/file-content` | Retrieves source code for a file and line range for the sliding CodeDrawer. |
| `POST` | `/api/chat/query` | Dual-retrieval conversational query returning prose, pills, code snippets, and graph data. |
| `GET` | `/api/graph/galaxy` | Returns top-level nodes and edges for the initial Galaxy View. |
| `GET` | `/api/graph/node-impact/{id}` | Calculates 1st and 2nd degree blast radius connections for a clicked entity. |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
