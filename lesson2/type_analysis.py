import json
import sys
from collections import defaultdict

"""
Analyzes a handful of statistics about a function:
    - Types of the variables declared within it
    - How many variables declared per type
    - How many times each variable is referenced by other expressions (pre-DCEesque scan)
"""
def analyze_variable_usage(fn):
    # Maps type headings to the variables that bind them
    types = {}

    # Map variables to list of all variables (and count) that reference them
    usages = {}
    use_counts = {}

    # Iterate through each instruction
    for insn in fn["instrs"]:
        
        # Add to type list
        if 'dest' in insn:
            if 'type' in insn:
                itype = "int_ptr" if isinstance(insn['type'], dict) else insn['type']
            else:
                itype = "unknown"
            if itype in types:
                types[itype].add(insn['dest'])
            else:
                types[itype] = {insn['dest']}

            
            # Add to mapping of variables to their usages
            if insn['dest'] not in usages:
                usages[insn['dest']] = set()

            if insn['dest'] not in use_counts:
                use_counts[insn['dest']] = 0

        # Scan through arguments used in expression, and update their usages
        if 'args' in insn:
            for arg in insn['args']:
                if arg in usages:
                    use_counts[arg] += 1
                    if 'dest' in insn:
                        usages[arg].add(insn['dest'])
                    

    # Print out statistics at the end
    print("\n\tType Statistics:")
    for tp in types:
        print(f"\t\t{tp}: {len(types[tp])}")

    print("\n\tVariable Usage:")
    for count in use_counts:
        print(f"\t\t{count}: {use_counts[count]}")

    print("\n\t Unused Variables:")
    for count in use_counts:
        if use_counts[count] == 0:
            print(f"\t\t{count}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python bril_cfg.py <bril_json_file>")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        bril_program = json.load(f)

    for function in bril_program.get("functions", []):
        print(f"\nFunction stats for @{function['name']}:")
        analyze_variable_usage(function)

if __name__ == "__main__":
    main()