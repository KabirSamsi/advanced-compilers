import json
import sys

"""
    Build a list of basic blocks from the instructions of a function
    Returns a dictionary mapping a block's heading label to it corresopnding block
"""
def block(fn):
    # Store all labeled blocks    
    blocks = {}
    label_order = ["start"]

    # Traverse each block and add it
    curr_label = "start"
    curr = []
    for insn in fn["instrs"]:
        #End block if it is a label or a terminator
        if "label" in insn:
            label_order.append(insn["label"])
            if curr != []:
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
    
    blocks[curr_label] = curr
    
    return blocks, label_order

""" Build a control-flow graph mapping labels to labels. """
def gen_cfg(blocked, labels):
    # Store dictionary form of CFG
    graph = {lbl : [] for lbl in blocked}

    # If block ends with a jump or branch, add those neighbors; otherwise just add the chronological next neighbor
    for key in blocked:
        if blocked[key]:
            move = blocked[key][-1]
            if 'op' in move and move['op'] in ['jmp', 'br']:
                for neighbor in move['labels']:
                    graph[key].append(neighbor)
            else:
                idx = labels.index(key)
                if idx < len(labels)-1:
                    graph[key].append(labels[labels.index(key)+1])
    
    return graph

def main():
    if len(sys.argv) < 2:
        print("Usage: python bril_cfg.py <bril_json_file>")
        sys.exit(1)

    with open(sys.argv[1], "r") as f:
        bril_program = json.load(f)

    for function in bril_program['functions']:
        print(f"\nFunction: @{function['name']}")
        blocks, labels = block(function)
        cfg = gen_cfg(blocks, labels)
        print(cfg)

if __name__ == "__main__":
    main()