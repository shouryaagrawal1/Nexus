"""Graph-RAG Orchestration service integrating ChromaDB, Neo4j, and Google Gemini."""
import re
import logging
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.services.chroma_service import chroma_service
from app.services.neo4j_service import neo4j_service
from app.schemas.chat import QueryResponse, CodeSnippet
from app.schemas.graph import GraphNode, GraphEdge

logger = logging.getLogger("nexus.rag")

MASTER_SYSTEM_PROMPT = """You are Nexus, an expert Senior Software Architect and Codebase Intelligence Agent.
Your job is to help a developer understand a massive, undocumented C++ and Python repository.

You will be provided with two types of context retrieved from our dual-database system:
1. SEMANTIC CODE SNIPPETS: Exact raw code blocks retrieved from a Vector DB.
2. STRUCTURAL DEPENDENCIES: Architecture relationships retrieved from a Graph DB.

=== SYSTEM RULES - READ CAREFULLY ===
1. NO HALLUCINATIONS: You must base your answer *entirely* on the provided context. If the answer is not in the context, you must explicitly say: "I cannot find this information in the indexed codebase." Do not guess file names or logic.
2. FRONTEND PILL FORMATTING: Whenever you mention a specific file name, class name, or function name in your prose, you MUST enclose it in double square brackets. Example: "The [[BaseDBWorker]] class handles this in [[worker.cpp]]." Our React frontend uses this exact syntax to render clickable interactive pills.
3. CODE SNIPPETS: When providing code examples to prove your point, use standard markdown code blocks. You MUST include the file name and line numbers above the block if known.
4. DEPENDENCY AWARENESS: If the user asks about modifying a function, explicitly warn them about the "Blast Radius" by listing other functions or classes that call it, based strictly on the STRUCTURAL DEPENDENCIES context.
5. GENERAL QUERIES: If the user asks a general programming or off-topic question unrelated to the context, politely remind them: "I cannot find this information in the indexed codebase. My scope is restricted to analyzing the currently indexed local repository."

=== CONTEXT ===
{retrieved_context}

=== USER QUERY ===
{user_query}

Provide your detailed, step-by-step architectural breakdown below:"""

class GraphRAGService:
    def __init__(self):
        self._llm: Optional[ChatGoogleGenerativeAI] = None
        self._current_model: Optional[str] = None

    def get_llm(self) -> ChatGoogleGenerativeAI:
        if not self._llm or self._current_model != settings.gemini_model:
            if not settings.gemini_api_key:
                raise ValueError("GEMINI_API_KEY is not set. Please add it to your .env file.")
            self._current_model = settings.gemini_model
            self._llm = ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                temperature=0.0,
                top_p=0.1,
                max_tokens=4096,
                google_api_key=settings.gemini_api_key
            )
        return self._llm

    def check_health(self) -> bool:
        """Verifies Gemini API credentials."""
        if not settings.gemini_api_key:
            return False
        return True

    def execute_query(self, query: str, chat_history: Optional[List[Dict[str, Any]]] = None) -> QueryResponse:
        """Executes dual vector + graph retrieval and queries the LLM with Nexus guardrails."""
        
        # Step 1: Semantic Search in ChromaDB (Top 5 chunks)
        vector_chunks = chroma_service.query_similar(query, n_results=5)

        # Step 2: Structural Graph Search in Neo4j (Blast radius of top vector nodes)
        graph_nodes_dict: Dict[str, GraphNode] = {}
        graph_edges_list: List[GraphEdge] = []
        graph_dependency_lines: List[str] = []

        for chunk in vector_chunks:
            meta = chunk.get("metadata", {})
            node_id = meta.get("neo4j_node_id") or chunk.get("id")
            if node_id:
                impact = neo4j_service.get_node_impact(node_id)
                for node in impact.get("nodes", []):
                    graph_nodes_dict[node.id] = node
                for edge in impact.get("edges", []):
                    graph_edges_list.append(edge)
                    # Create human-readable description for prompt
                    src_label = graph_nodes_dict.get(edge.source, GraphNode(id=edge.source, label=edge.source, type="Node", file_path="")).label
                    tgt_label = graph_nodes_dict.get(edge.target, GraphNode(id=edge.target, label=edge.target, type="Node", file_path="")).label
                    graph_dependency_lines.append(f"- `{src_label}` {edge.relationship_type} `{tgt_label}`")

        # Edge Case 1: Empty Context Scenario (Zero Results)
        if not vector_chunks and not graph_nodes_dict:
            fallback_text = (
                f"I scanned the indexed repository but could not find any structural or semantic references to "
                f"'{query}'. Please check your spelling or ensure the relevant folder wasn't excluded during ingestion."
            )
            return QueryResponse(
                response_text=fallback_text,
                file_pills=[],
                snippets=[],
                graph_data={"nodes": [], "edges": []}
            )

        # Step 3: Context Concatenation
        chroma_section_lines = []
        snippets_for_response: List[CodeSnippet] = []

        for c in vector_chunks:
            meta = c.get("metadata", {})
            file_p = meta.get("file_path", "unknown")
            s_line = meta.get("start_line", 1)
            e_line = meta.get("end_line", s_line + 20)
            lang = meta.get("language", "python")
            doc = c.get("document", "")

            chroma_section_lines.append(f"File: {file_p} (Lines {s_line}-{e_line})\nCode:\n{doc}\n")
            snippets_for_response.append(CodeSnippet(
                file_path=file_p,
                language=lang,
                start_line=s_line,
                end_line=e_line,
                code=doc
            ))

        retrieved_context = (
            "=== CHROMA DB CODE SNIPPETS ===\n" +
            "\n".join(chroma_section_lines) +
            "\n=== NEO4J GRAPH DEPENDENCIES ===\n" +
            ("\n".join(set(graph_dependency_lines)) if graph_dependency_lines else "None found.")
        )

        formatted_prompt = MASTER_SYSTEM_PROMPT.format(
            retrieved_context=retrieved_context,
            user_query=query
        )

        # Step 4: LLM Generation
        try:
            llm = self.get_llm()
            messages = [
                SystemMessage(content="You are Nexus, an expert Senior Software Architect and Codebase Intelligence Agent."),
                HumanMessage(content=formatted_prompt)
            ]
            ai_message = llm.invoke(messages)
            raw_content = ai_message.content
            if isinstance(raw_content, list):
                text_parts = [item.get("text", "") for item in raw_content if isinstance(item, dict) and "text" in item]
                response_text = "".join(text_parts) if text_parts else str(raw_content)
            else:
                response_text = str(raw_content)
        except Exception as e:
            logger.error(f"LLM execution failed: {e}")
            raise e

        # Step 5: Extract [[pills]] using regex
        pills_matches = re.findall(r"\[\[(.*?)\]\]", response_text)
        unique_pills = list(dict.fromkeys(pills_matches))

        return QueryResponse(
            response_text=response_text,
            file_pills=unique_pills,
            snippets=snippets_for_response,
            graph_data={
                "nodes": [n.model_dump() for n in graph_nodes_dict.values()],
                "edges": [e.model_dump() for e in graph_edges_list]
            }
        )

rag_service = GraphRAGService()
