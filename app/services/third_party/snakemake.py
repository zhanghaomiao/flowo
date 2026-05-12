import re
import subprocess
from pathlib import Path
from typing import Any

from fastapi import HTTPException


def _parse_dot_to_graph_json(dot_string: str) -> dict[str, Any]:
    """Parse DOT output from 'snakemake --rulegraph' into JSON format."""
    nodes: list[dict[str, str]] = []
    links: list[dict[str, Any]] = []
    id_to_rule: dict[int, str] = {}

    # Match node definitions: 0[label = "all", ...]
    node_pattern = re.compile(r'(\d+)\[label\s*=\s*"([^"]+)"')
    # Match edge definitions: 0 -> 1
    edge_pattern = re.compile(r"(\d+)\s*->\s*(\d+)")

    for line in dot_string.splitlines():
        line = line.strip()

        node_match = node_pattern.search(line)
        if node_match:
            node_id = int(node_match.group(1))
            rule_name = node_match.group(2)
            id_to_rule[node_id] = rule_name
            continue

        edge_match = edge_pattern.search(line)
        if edge_match:
            source_id = int(edge_match.group(1))
            target_id = int(edge_match.group(2))
            links.append(
                {
                    "source": source_id,
                    "target": target_id,
                    "sourcerule": "",  # filled below
                    "targetrule": "",
                }
            )

    # Build nodes list in ID order
    for node_id in sorted(id_to_rule):
        nodes.append({"rule": id_to_rule[node_id]})

    # Fill in rule names for links
    for link in links:
        link["sourcerule"] = id_to_rule.get(link["source"], "")
        link["targetrule"] = id_to_rule.get(link["target"], "")

    return {"nodes": nodes, "links": links}


class SnakemakeService:
    """Service for Snakemake operations."""

    def generate_dag(self, catalog_path: Path) -> dict[str, Any]:
        """Generate DAG data by running snakemake --rulegraph."""
        snakefile = catalog_path / "workflow" / "Snakefile"
        if not snakefile.exists():
            snakefile = catalog_path / "Snakefile"

        if not snakefile.exists():
            raise HTTPException(status_code=404, detail="Snakefile not found")

        try:
            result = subprocess.run(
                [
                    "snakemake",
                    "--rulegraph",
                    "-s",
                    str(snakefile),
                    "--directory",
                    str(catalog_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(catalog_path),
            )

            if result.returncode != 0:
                # Return partial data with error if snakemake fails
                return {
                    "nodes": [],
                    "links": [],
                    "error": result.stderr or "Failed to generate DAG",
                }

            return {**_parse_dot_to_graph_json(result.stdout), "error": None}

        except HTTPException:
            raise
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=500,
                detail="snakemake is not installed on the server",
            ) from e
        except subprocess.TimeoutExpired as e:
            raise HTTPException(
                status_code=504,
                detail="DAG generation timed out",
            ) from e


# Global singleton
snakemake_service = SnakemakeService()
