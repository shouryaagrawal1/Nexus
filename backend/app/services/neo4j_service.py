"""Neo4j graph database integration service."""
import logging
from typing import List, Dict, Any, Optional
from neo4j import GraphDatabase, Driver
from app.config import settings
from app.schemas.graph import GraphNode, GraphEdge

logger = logging.getLogger("nexus.neo4j")

class Neo4jService:
    def __init__(self):
        self._driver: Optional[Driver] = None

    def get_driver(self) -> Driver:
        if not self._driver:
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password)
            )
        return self._driver

    def close(self):
        if self._driver:
            self._driver.close()
            self._driver = None

    def check_health(self) -> bool:
        try:
            driver = self.get_driver()
            with driver.session() as session:
                result = session.run("RETURN 1 as test")
                record = result.single()
                return record and record["test"] == 1
        except Exception as e:
            logger.error(f"Neo4j health check failed: {e}")
            return False

    def init_constraints_and_indexes(self):
        """Creates unique constraints and indexes according to specification section 4.3."""
        queries = [
            "CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (n:Function) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE",
            "CREATE INDEX file_path_index IF NOT EXISTS FOR (f:File) ON (f.file_path)"
        ]
        driver = self.get_driver()
        with driver.session() as session:
            for query in queries:
                try:
                    session.run(query)
                except Exception as e:
                    logger.warning(f"Constraint query skipped or already exists: {e}")

    def batch_insert_nodes(self, nodes: List[Dict[str, Any]], batch_size: int = 1000):
        """Batch inserts nodes using Cypher UNWIND for high performance."""
        if not nodes:
            return
        driver = self.get_driver()
        query = """
        UNWIND $batch AS item
        MERGE (n:Entity {id: item.id})
        SET n.label = item.label,
            n.type = item.type,
            n.file_path = item.file_path,
            n.line_number = item.line_number
        WITH n, item
        CALL apoc.create.addLabels(n, [item.type]) YIELD node
        RETURN count(node)
        """
        # Fallback if APOC not active: execute direct label queries
        fallback_queries = {
            "File": "UNWIND $batch AS item MERGE (f:File {id: item.id}) SET f.label = item.label, f.file_path = item.file_path, f.language = item.language",
            "Class": "UNWIND $batch AS item MERGE (c:Class {id: item.id}) SET c.label = item.label, c.name = item.label, c.file_path = item.file_path, c.line_number = item.line_number",
            "Function": "UNWIND $batch AS item MERGE (fn:Function {id: item.id}) SET fn.label = item.label, fn.name = item.label, fn.file_path = item.file_path, fn.line_number = item.line_number"
        }

        with driver.session() as session:
            for i in range(0, len(nodes), batch_size):
                batch = nodes[i:i + batch_size]
                # Split by type for pure Cypher reliability without requiring APOC
                for n_type, cypher in fallback_queries.items():
                    type_batch = [n for n in batch if n.get("type") == n_type]
                    if type_batch:
                        session.run(cypher, batch=type_batch)

    def batch_insert_edges(self, edges: List[Dict[str, Any]], batch_size: int = 1000):
        """Batch inserts relationships using Cypher UNWIND."""
        if not edges:
            return
        driver = self.get_driver()
        
        edge_queries = {
            "DEFINED_IN": "UNWIND $batch AS e MATCH (a {id: e.source}), (b {id: e.target}) MERGE (a)-[r:DEFINED_IN]->(b) SET r.resolution = e.resolution",
            "CONTAINS": "UNWIND $batch AS e MATCH (a {id: e.source}), (b {id: e.target}) MERGE (a)-[r:CONTAINS]->(b)",
            "INHERITS_FROM": "UNWIND $batch AS e MATCH (a {id: e.source}), (b {id: e.target}) MERGE (a)-[r:INHERITS_FROM]->(b)",
            "CALLS": "UNWIND $batch AS e MATCH (a {id: e.source}), (b {id: e.target}) MERGE (a)-[r:CALLS]->(b) SET r.resolution = coalesce(e.resolution, 'name_match')"
        }

        with driver.session() as session:
            for i in range(0, len(edges), batch_size):
                batch = edges[i:i + batch_size]
                for rel_type, cypher in edge_queries.items():
                    rel_batch = [e for e in batch if e.get("relationship_type") == rel_type]
                    if rel_batch:
                        session.run(cypher, batch=rel_batch)

    def get_node_impact(self, node_id: str) -> Dict[str, Any]:
        """Fetches 1st and 2nd degree callers/callees/parents for the Blast Radius."""
        driver = self.get_driver()
        query = """
        MATCH (start {id: $node_id})
        OPTIONAL MATCH path = (start)-[r:CALLS|INHERITS_FROM|CONTAINS*1..2]-(connected)
        WITH start, collect(relationships(path)) as rels_list, collect(connected) as conns
        UNWIND rels_list AS rels
        UNWIND rels AS rel
        WITH start, conns, collect(DISTINCT rel) as unique_rels
        RETURN start, conns, unique_rels
        """
        nodes_dict: Dict[str, GraphNode] = {}
        edges_list: List[GraphEdge] = []

        with driver.session() as session:
            result = session.run(query, node_id=node_id)
            record = result.single()
            if not record or not record["start"]:
                return {"nodes": [], "edges": []}
            
            start = record["start"]
            nodes_dict[start["id"]] = GraphNode(
                id=start["id"],
                label=start.get("label", start.get("name", "Unknown")),
                type=list(start.labels)[0] if hasattr(start, "labels") and start.labels else "Entity",
                file_path=start.get("file_path", ""),
                line_number=start.get("line_number", 1)
            )

            for conn in record["conns"]:
                if conn and conn["id"] not in nodes_dict:
                    nodes_dict[conn["id"]] = GraphNode(
                        id=conn["id"],
                        label=conn.get("label", conn.get("name", "Unknown")),
                        type=list(conn.labels)[0] if hasattr(conn, "labels") and conn.labels else "Entity",
                        file_path=conn.get("file_path", ""),
                        line_number=conn.get("line_number", 1)
                    )

            for rel in record["unique_rels"]:
                if rel:
                    edges_list.append(GraphEdge(
                        source=rel.start_node["id"],
                        target=rel.end_node["id"],
                        relationship_type=rel.type,
                        resolution=rel.get("resolution", "name_match")
                    ))

        return {
            "nodes": list(nodes_dict.values()),
            "edges": edges_list
        }

    def get_galaxy_view(self, limit: int = 250) -> Dict[str, Any]:
        """Returns top-level repository structure for initial Galaxy View canvas."""
        driver = self.get_driver()
        query = f"""
        MATCH (n)
        WHERE n:Class OR n:Function OR n:File
        WITH n LIMIT {limit}
        OPTIONAL MATCH (n)-[r]->(m)
        WHERE m:Class OR m:Function OR m:File
        RETURN collect(DISTINCT n) as nodes, collect(DISTINCT r) as edges
        """
        nodes = []
        edges = []
        with driver.session() as session:
            result = session.run(query)
            record = result.single()
            if record:
                for n in record["nodes"]:
                    nodes.append(GraphNode(
                        id=n["id"],
                        label=n.get("label", n.get("name", n.get("file_path", "Node"))),
                        type=list(n.labels)[0] if hasattr(n, "labels") and n.labels else "Entity",
                        file_path=n.get("file_path", ""),
                        line_number=n.get("line_number", 1)
                    ))
                for r in record["edges"]:
                    if r:
                        edges.append(GraphEdge(
                            source=r.start_node["id"],
                            target=r.end_node["id"],
                            relationship_type=r.type,
                            resolution=r.get("resolution", "name_match")
                        ))
        return {"nodes": nodes, "edges": edges}

neo4j_service = Neo4jService()
