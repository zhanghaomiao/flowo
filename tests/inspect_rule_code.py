import os
from pathlib import Path

from snakemake import wrapper
from snakemake.api import (
    OutputSettings,
    ResourceSettings,
    SnakemakeApi,
)
from snakemake.script import get_source

# Setup dummy files
snakefile_path = Path("Snakefile.test")
script_path = Path("scripts/test_script.py")

os.makedirs("scripts", exist_ok=True)
with open(snakefile_path, "w") as f:
    f.write("""
rule a:
    input: "in.txt"
    output: "out_a.txt"
    shell: "echo 'running rule a' > {output}"

rule b:
    input: "out_a.txt"
    output: "out_b.txt"
    script: "scripts/test_script.py"

rule c:
    output: "out_c.txt"
    wrapper: "v1.0.0/bio/samtools/sort"
""")

with open(script_path, "w") as f:
    f.write("print('hello from script')")

print("--- Snakemake v8+ Rule Code Extraction Research ---")

try:
    with SnakemakeApi(OutputSettings(quiet=True)) as snakemake_api:
        workflow_api = snakemake_api.workflow(
            resource_settings=ResourceSettings(cores=1),
            snakefile=snakefile_path,
        )
        wf = workflow_api._workflow

        print(f"\n[OK] Workflow loaded with {len(wf.rules)} rules.\n")

        for rule in wf.rules:
            print(f"Rule: {rule.name}")

            code = "N/A"
            language = "unknown"

            try:
                if rule.shellcmd is not None:
                    code = rule.shellcmd
                    language = "bash"
                    print("  [Type] Shell")
                elif rule.script is not None:
                    print(f"  [Type] Script ({rule.script})")
                    _, code, language, _, _ = get_source(
                        rule.script, wf.sourcecache, rule.basedir
                    )
                elif rule.wrapper is not None:
                    print(f"  [Type] Wrapper ({rule.wrapper})")
                    # Note: wrapper.get_script returns an rsync-style path or URL
                    wrapper_url = wrapper.get_script(
                        rule.wrapper,
                        wf.sourcecache,
                        prefix=wf.workflow_settings.wrapper_prefix,
                    )
                    print(f"  [Info] Wrapper URL: {wrapper_url}")
                    _, code, language, _, _ = get_source(wrapper_url, wf.sourcecache)

                print(f"  [Lang] {language}")
                print(f"  [Code] {code.strip()[:100]}...")
            except Exception as inner_e:
                print(f"  [Error] Failed to extract code: {inner_e}")

            print("-" * 30)

except Exception as e:
    print(f"Fatal Error: {e}")
    # traceback.print_exc()

finally:
    # Cleanup
    if snakefile_path.exists():
        os.remove(snakefile_path)
    if script_path.exists():
        os.remove(script_path)
    if Path("scripts").exists() and not os.listdir("scripts"):
        os.rmdir("scripts")

print("\nResearch complete.")
