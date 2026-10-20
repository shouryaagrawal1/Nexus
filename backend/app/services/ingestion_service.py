"""Ingestion orchestrator that streams real-time progress via SSE."""
import os
import uuid
import asyncio
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.services.parser import code_parser
from app.services.neo4j_service import neo4j_service
from app.services.chroma_service import chroma_service

class IngestionManager:
    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.current_repo_path: Optional[str] = None

    def start_session(self, repo_path: str, languages: List[str], exclude_folders: List[str]) -> str:
        session_id = f"req-{uuid.uuid4().hex[:7]}"
        self.current_repo_path = repo_path
        self.active_sessions[session_id] = {
            "repo_path": repo_path,
            "languages": languages,
            "exclude_folders": exclude_folders,
            "status": "initialized"
        }
        return session_id

    async def run_ingestion_stream(self, session_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        session = self.active_sessions.get(session_id)
        if not session:
            yield {
                "stage": "ERROR",
                "current": 0,
                "total": 0,
                "message": f"Session {session_id} not found."
            }
            return

        repo_path = session["repo_path"]
        languages = session["languages"]
        exclude_folders = session["exclude_folders"]

        # Step 1: File Discovery
        files = list(code_parser.discover_files(repo_path, exclude_folders, languages))
        total_files = len(files)
        if total_files == 0:
            yield {
                "stage": "ERROR",
                "current": 0,
                "total": 0,
                "message": "No valid Python or C++ files found in specified path."
            }
            return

        # Ensure Neo4j constraints exist before ingestion
        neo4j_service.init_constraints_and_indexes()

        # Step 2: AST Parsing (File-by-file generator to conserve laptop memory)
        all_nodes: List[Dict[str, Any]] = []
        all_edges: List[Dict[str, Any]] = []
        all_chunks: List[Dict[str, Any]] = []
        all_calls: List[tuple] = [] # (caller_id, callee_name)
        class_name_map: Dict[str, str] = {} # class_name -> class_id
        func_name_map: Dict[str, List[str]] = {} # func_name -> list of func_ids

        for idx, file_path in enumerate(files, start=1):
            rel_name = os.path.basename(file_path)
            yield {
                "stage": "AST_PARSING",
                "current": idx,
                "total": total_files,
                "message": f"Parsing {rel_name}"
            }
            # Give control back to event loop for SSE streaming
            await asyncio.sleep(0.005)

            parsed = code_parser.parse_file(file_path, repo_path)
            if "error" in parsed:
                continue

            all_nodes.append(parsed["file"])
            for c in parsed["classes"]:
                all_nodes.append(c)
                class_name_map[c["label"]] = c["id"]

            for fn in parsed["functions"]:
                all_nodes.append(fn)
                func_name_map.setdefault(fn["label"], []).append(fn["id"])

            for e in parsed["edges"]:
                all_edges.append(e)

            for chunk in parsed["vector_chunks"]:
                all_chunks.append(chunk)

            for call in parsed["raw_calls"]:
                all_calls.append(call)

        # Step 3: Graph Mapping & Relationship Resolution
        yield {
            "stage": "GRAPH_MAPPING",
            "current": 0,
            "total": total_files,
            "message": "Resolving class inheritance and call relationships"
        }
        await asyncio.sleep(0.01)

        # Resolve INHERITS_FROM
        resolved_edges: List[Dict[str, Any]] = []
        for edge in all_edges:
            if edge["relationship_type"] == "INHERITS_FROM":
                target_name = edge.get("target_name")
                if target_name in class_name_map:
                    edge["target"] = class_name_map[target_name]
                    resolved_edges.append(edge)
            else:
                resolved_edges.append(edge)

        # Resolve CALLS (Approximate name matching with documented resolution boundary)
        for caller_id, callee_name in all_calls:
            if callee_name in func_name_map:
                for target_id in func_name_map[callee_name]:
                    resolved_edges.append({
                        "source": caller_id,
                        "target": target_id,
                        "relationship_type": "CALLS",
                        "resolution": "name_match"
                    })

        # Write to Neo4j first (referential integrity)
        yield {
            "stage": "GRAPH_MAPPING",
            "current": total_files // 2,
            "total": total_files,
            "message": f"Writing {len(all_nodes)} nodes and {len(resolved_edges)} edges to Neo4j"
        }
        await asyncio.sleep(0.01)

        neo4j_service.batch_insert_nodes(all_nodes, batch_size=1000)
        neo4j_service.batch_insert_edges(resolved_edges, batch_size=1000)

        yield {
            "stage": "GRAPH_MAPPING",
            "current": total_files,
            "total": total_files,
            "message": "Graph mapping complete in Neo4j"
        }
        await asyncio.sleep(0.01)

        # Step 4: Vector Embedding into ChromaDB
        yield {
            "stage": "VECTOR_EMBEDDING",
            "current": 0,
            "total": len(all_chunks),
            "message": f"Embedding {len(all_chunks)} AST-aware chunks into ChromaDB"
        }
        await asyncio.sleep(0.01)

        chroma_service.batch_add_chunks(all_chunks, batch_size=100)

        yield {
            "stage": "VECTOR_EMBEDDING",
            "current": len(all_chunks),
            "total": len(all_chunks),
            "message": "Vector embedding complete"
        }
        await asyncio.sleep(0.01)

        # Step 5: Complete
        yield {
            "stage": "COMPLETE",
            "current": 100,
            "total": 100,
            "message": f"Indexing finished! Indexed {len(all_nodes)} entities and {len(all_chunks)} vector chunks."
        }

ingestion_manager = IngestionManager()
