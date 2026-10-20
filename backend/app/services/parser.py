"""AST Parsing service using Tree-sitter with memory-safe generator processing."""
import os
import hashlib
from typing import Generator, Dict, Any, List, Tuple, Optional
from pathlib import Path

# Tree-sitter imports
import tree_sitter
from tree_sitter import Parser, Language
import tree_sitter_python as tspython
import tree_sitter_cpp as tscpp

def _get_language(lang_module):
    """Safely initializes Tree-sitter Language across API versions."""
    if hasattr(lang_module, "language"):
        raw_lang = lang_module.language()
        return Language(raw_lang) if not isinstance(raw_lang, Language) else raw_lang
    return Language(lang_module)

PY_LANGUAGE = _get_language(tspython)
CPP_LANGUAGE = _get_language(tscpp)

def md5_hash(text: str) -> str:
    """Generates deterministic MD5 hash identifier."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()

class CodeASTParser:
    def __init__(self):
        self.py_parser = Parser(PY_LANGUAGE)
        self.cpp_parser = Parser(CPP_LANGUAGE)

    def discover_files(
        self,
        repo_path: str,
        exclude_folders: Optional[List[str]] = None,
        languages: Optional[List[str]] = None
    ) -> Generator[str, None, None]:
        """Discovers valid code files using os.walk generator without loading into memory."""
        if exclude_folders is None:
            exclude_folders = ["node_modules", "venv", ".venv", "build", ".git", "__pycache__", ".chroma_data", "neo4j_data"]
        
        valid_exts = set()
        if not languages or "python" in languages:
            valid_exts.add(".py")
        if not languages or "cpp" in languages:
            valid_exts.update([".cpp", ".h", ".hpp", ".cc", ".cxx"])

        exclude_set = set(exclude_folders)
        for root, dirs, files in os.walk(repo_path):
            # Prune excluded directories in-place to avoid unnecessary directory walking
            dirs[:] = [d for d in dirs if d not in exclude_set and not d.startswith(".")]
            for file in files:
                ext = Path(file).suffix.lower()
                if ext in valid_exts:
                    yield os.path.normpath(os.path.join(root, file))

    def count_valid_files(
        self,
        repo_path: str,
        exclude_folders: Optional[List[str]] = None,
        languages: Optional[List[str]] = None
    ) -> int:
        """Counts files for progress tracking."""
        count = 0
        for _ in self.discover_files(repo_path, exclude_folders, languages):
            count += 1
        return count

    def parse_file(self, file_path: str, repo_root: str) -> Dict[str, Any]:
        """Parses a single source file and returns AST records, edges, and vector chunks."""
        rel_path = os.path.relpath(file_path, repo_root).replace("\\", "/")
        ext = Path(file_path).suffix.lower()
        language = "python" if ext == ".py" else "cpp"
        parser = self.py_parser if language == "python" else self.cpp_parser

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                code_content = f.read()
        except Exception as e:
            return {"error": str(e), "file_path": rel_path}

        tree = parser.parse(bytes(code_content, "utf-8"))
        root_node = tree.root_node

        file_id = md5_hash(rel_path)
        file_record = {
            "id": file_id,
            "label": Path(rel_path).name,
            "type": "File",
            "file_path": rel_path,
            "language": language,
            "line_number": 1
        }

        classes = []
        functions = []
        edges = []
        vector_chunks = []
        raw_calls = [] # (caller_id, callee_name)

        if language == "python":
            self._parse_python_nodes(
                root_node, code_content, rel_path, file_id,
                classes, functions, edges, vector_chunks, raw_calls
            )
        else:
            self._parse_cpp_nodes(
                root_node, code_content, rel_path, file_id,
                classes, functions, edges, vector_chunks, raw_calls
            )

        return {
            "file": file_record,
            "classes": classes,
            "functions": functions,
            "edges": edges,
            "vector_chunks": vector_chunks,
            "raw_calls": raw_calls
        }

    def _parse_python_nodes(
        self, node, code: str, rel_path: str, file_id: str,
        classes: list, functions: list, edges: list, vector_chunks: list, raw_calls: list,
        current_class: Optional[Dict[str, Any]] = None
    ):
        for child in node.children:
            if child.type == "class_definition":
                name_node = child.child_by_field_name("name")
                class_name = code[name_node.start_byte:name_node.end_byte] if name_node else "AnonymousClass"
                class_id = md5_hash(f"{rel_path}:{class_name}")
                start_line = child.start_point[0] + 1
                end_line = child.end_point[0] + 1

                class_record = {
                    "id": class_id,
                    "label": class_name,
                    "type": "Class",
                    "file_path": rel_path,
                    "start_line": start_line,
                    "end_line": end_line,
                    "line_number": start_line
                }
                classes.append(class_record)

                # Class DEFINED_IN File
                edges.append({
                    "source": class_id,
                    "target": file_id,
                    "relationship_type": "DEFINED_IN"
                })

                # Check inheritance
                args_node = child.child_by_field_name("superclasses")
                if args_node:
                    for arg in args_node.children:
                        if arg.type in ("identifier", "attribute"):
                            base_name = code[arg.start_byte:arg.end_byte]
                            # INHERITS_FROM parent class name
                            edges.append({
                                "source": class_id,
                                "target": base_name, # to be resolved against class name index
                                "relationship_type": "INHERITS_FROM",
                                "target_name": base_name
                            })

                # Vector chunk for class definition & docstring
                class_snippet = code[child.start_byte:child.end_byte]
                vector_chunks.append({
                    "id": class_id,
                    "document": class_snippet[:2000], # Class overview
                    "metadata": {
                        "neo4j_node_id": class_id,
                        "type": "Class",
                        "name": class_name,
                        "file_path": rel_path,
                        "language": "python",
                        "start_line": start_line,
                        "end_line": end_line
                    }
                })

                # Recurse inside class to find methods
                self._parse_python_nodes(
                    child, code, rel_path, file_id,
                    classes, functions, edges, vector_chunks, raw_calls,
                    current_class=class_record
                )

            elif child.type == "function_definition":
                name_node = child.child_by_field_name("name")
                func_name = code[name_node.start_byte:name_node.end_byte] if name_node else "anonymous"
                start_line = child.start_point[0] + 1
                end_line = child.end_point[0] + 1

                if current_class:
                    func_id = md5_hash(f"{rel_path}:{current_class['label']}.{func_name}")
                    # Class CONTAINS Function
                    edges.append({
                        "source": current_class["id"],
                        "target": func_id,
                        "relationship_type": "CONTAINS"
                    })
                else:
                    func_id = md5_hash(f"{rel_path}:{func_name}")

                func_record = {
                    "id": func_id,
                    "label": func_name,
                    "type": "Function",
                    "file_path": rel_path,
                    "start_line": start_line,
                    "end_line": end_line,
                    "line_number": start_line
                }
                functions.append(func_record)

                # Function DEFINED_IN File
                edges.append({
                    "source": func_id,
                    "target": file_id,
                    "relationship_type": "DEFINED_IN"
                })

                # AST-Aware Chunk: complete function code block
                func_snippet = code[child.start_byte:child.end_byte]
                vector_chunks.append({
                    "id": func_id,
                    "document": func_snippet,
                    "metadata": {
                        "neo4j_node_id": func_id,
                        "type": "Function",
                        "name": func_name,
                        "file_path": rel_path,
                        "language": "python",
                        "start_line": start_line,
                        "end_line": end_line
                    }
                })

                # Extract function calls inside function body
                self._extract_python_calls(child, code, func_id, raw_calls)

            else:
                self._parse_python_nodes(
                    child, code, rel_path, file_id,
                    classes, functions, edges, vector_chunks, raw_calls,
                    current_class=current_class
                )

    def _extract_python_calls(self, node, code: str, caller_id: str, raw_calls: list):
        """Finds calls like retry_connection() or db.connect() inside a function."""
        for child in node.children:
            if child.type == "call":
                func_part = child.child_by_field_name("function")
                if func_part:
                    callee_text = code[func_part.start_byte:func_part.end_byte]
                    # Get symbol name (e.g., db.connect -> connect)
                    callee_name = callee_text.split(".")[-1].strip()
                    raw_calls.append((caller_id, callee_name))
            self._extract_python_calls(child, code, caller_id, raw_calls)

    def _parse_cpp_nodes(
        self, node, code: str, rel_path: str, file_id: str,
        classes: list, functions: list, edges: list, vector_chunks: list, raw_calls: list,
        current_class: Optional[Dict[str, Any]] = None
    ):
        for child in node.children:
            if child.type in ("class_specifier", "struct_specifier"):
                name_node = child.child_by_field_name("name")
                class_name = code[name_node.start_byte:name_node.end_byte] if name_node else "AnonymousClass"
                class_id = md5_hash(f"{rel_path}:{class_name}")
                start_line = child.start_point[0] + 1
                end_line = child.end_point[0] + 1

                class_record = {
                    "id": class_id,
                    "label": class_name,
                    "type": "Class",
                    "file_path": rel_path,
                    "start_line": start_line,
                    "end_line": end_line,
                    "line_number": start_line
                }
                classes.append(class_record)

                edges.append({
                    "source": class_id,
                    "target": file_id,
                    "relationship_type": "DEFINED_IN"
                })

                # Check base class inheritance
                base_clause = child.child_by_field_name("base_class_clause")
                if base_clause:
                    for b_child in base_clause.children:
                        if b_child.type == "type_identifier":
                            parent_name = code[b_child.start_byte:b_child.end_byte]
                            edges.append({
                                "source": class_id,
                                "target": parent_name,
                                "relationship_type": "INHERITS_FROM",
                                "target_name": parent_name
                            })

                class_snippet = code[child.start_byte:child.end_byte]
                vector_chunks.append({
                    "id": class_id,
                    "document": class_snippet[:2000],
                    "metadata": {
                        "neo4j_node_id": class_id,
                        "type": "Class",
                        "name": class_name,
                        "file_path": rel_path,
                        "language": "cpp",
                        "start_line": start_line,
                        "end_line": end_line
                    }
                })

                self._parse_cpp_nodes(
                    child, code, rel_path, file_id,
                    classes, functions, edges, vector_chunks, raw_calls,
                    current_class=class_record
                )

            elif child.type == "function_definition":
                declarator = child.child_by_field_name("declarator")
                func_name = "anonymous"
                if declarator:
                    #declarator may be function_declarator
                    func_id_node = declarator.child_by_field_name("declarator") or declarator
                    func_name = code[func_id_node.start_byte:func_id_node.end_byte].split("(")[0].strip()

                start_line = child.start_point[0] + 1
                end_line = child.end_point[0] + 1

                if current_class:
                    func_id = md5_hash(f"{rel_path}:{current_class['label']}.{func_name}")
                    edges.append({
                        "source": current_class["id"],
                        "target": func_id,
                        "relationship_type": "CONTAINS"
                    })
                else:
                    func_id = md5_hash(f"{rel_path}:{func_name}")

                func_record = {
                    "id": func_id,
                    "label": func_name,
                    "type": "Function",
                    "file_path": rel_path,
                    "start_line": start_line,
                    "end_line": end_line,
                    "line_number": start_line
                }
                functions.append(func_record)

                edges.append({
                    "source": func_id,
                    "target": file_id,
                    "relationship_type": "DEFINED_IN"
                })

                func_snippet = code[child.start_byte:child.end_byte]
                vector_chunks.append({
                    "id": func_id,
                    "document": func_snippet,
                    "metadata": {
                        "neo4j_node_id": func_id,
                        "type": "Function",
                        "name": func_name,
                        "file_path": rel_path,
                        "language": "cpp",
                        "start_line": start_line,
                        "end_line": end_line
                    }
                })

                self._extract_cpp_calls(child, code, func_id, raw_calls)

            else:
                self._parse_cpp_nodes(
                    child, code, rel_path, file_id,
                    classes, functions, edges, vector_chunks, raw_calls,
                    current_class=current_class
                )

    def _extract_cpp_calls(self, node, code: str, caller_id: str, raw_calls: list):
        """Extracts C++ function call expressions."""
        for child in node.children:
            if child.type == "call_expression":
                func_part = child.child_by_field_name("function")
                if func_part:
                    callee_text = code[func_part.start_byte:func_part.end_byte]
                    callee_name = callee_text.split(".")[-1].split("->")[-1].strip()
                    raw_calls.append((caller_id, callee_name))
            self._extract_cpp_calls(child, code, caller_id, raw_calls)

code_parser = CodeASTParser()
