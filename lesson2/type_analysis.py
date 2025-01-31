import json
import sys
from collections import defaultdict

def analyze(fn):
    # Maps variables to their types
    vars = {}

    # Map variables to list of all variables that reference them
    usages = {}
    use_counts = {}

    for insn in fn["instrs"]:
        if 'dest' in insn:
            # Add to list of variables by type
            vars[insn['dest']] = insn['type'] if 'type' in insn else None
            
            # Add to mapping of variables to their usages
            if insn['dest'] not in usages:
                usages[insn['dest']] = set()
                use_counts[insn['dest']] = 0

        if 'args' in insn:
            for arg in insn['args']:
                if arg in usages:
                    usages[arg].add(insn['dest'])

    print(vars)

def main():
    if len(sys.argv) < 2:
        print("Usage: python bril_cfg.py <bril_json_file>")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        bril_program = json.load(f)

    for function in bril_program.get("functions", []):
        print(f"\nFunction: {function['name']}")
        analyze(function)

if __name__ == "__main__":
    main()