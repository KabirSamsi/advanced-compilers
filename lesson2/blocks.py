import json
import sys
from collections import defaultdict

def block(function):
    if len(function) == 0:
        return []
    
    # Store all labels
    labels = {}    

    if "label" not in function[0]:
        labels["start"] = []


    for insn in function["instrs"]:
        if "label" in insn:
            labels[]


    # Traverse through and track current label

    # When we reach a jump or break, chunk the new block in

    # Insert a new block if necessary right after
    

def main():
    if len(sys.argv) < 2:
        print("Usage: python bril_cfg.py <bril_json_file>")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        bril_program = json.load(f)

    for function in bril_program.get("functions", []):
        print(f"\nFunction: {function['name']}")
        block(function)

if __name__ == "__main__":
    main()