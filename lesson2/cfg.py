import json
import sys
from collections import defaultdict

"""
    Build a list of basic blocks from the instructions of a function
    Returns a dictionary mapping a block's heading label to it corresopnding block
"""
def block(fn):
    # Store all labeled blocks    
    blocks = {}

    # Traverse each block and add it
    curr_label = ""
    curr = []
    print(fn.keys())
    for insn in fn["instrs"]:
        #End block if it is a label or a terminator
        if "label" in insn:
            blocks[curr_label] = curr
            curr_label = insn["label"] # Update new label
            curr = []
        elif "op" in insn and insn["op"] in ["jmp", "br"]:
            curr.append(insn)
            blocks[curr_label] = curr
            curr = []
        # If not, continue to build up block
        else:
            curr.append(insn)
    
    return blocks
    
def gen_cfg(function):
    blocked = block(function)

def main():
    if len(sys.argv) < 2:
        print("Usage: python bril_cfg.py <bril_json_file>")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        bril_program = json.load(f)

    for function in bril_program.get("functions", []):
        print(f"\n Function: @{function['name']}")
        cfg = gen_cfg(block(function))
        print(cfg)

if __name__ == "__main__":
    main()