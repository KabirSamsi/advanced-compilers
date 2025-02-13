
import { stdin } from "process";

// Bril program types
type brilInstruction = {
    label?: string;
    dest?: string;
    op?: string;
    args?: Array<string>,
    functions?: Array<string>,
    labels?: Array<string>,
    value?: any,
    type?: any
};

type brilFunction = {
    instrs?: Array<brilInstruction>;
    name?: string;
    args?: Array<string>,
    type?: string | undefined
};

type brilProgram = {functions?: Array<brilFunction>};

type block = Map<string, Array<brilInstruction>>;

type graph = Map<String, Array<String>>;

/*
    Generate a series of basic blocks from a given instructions.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels.
*/
const basicBlock = (instrs : Array<brilInstruction>) : Map<string, Array<brilInstruction>> => {
    // Store all labeled blocks    
    let blocks : Map<string, Array<brilInstruction>> = new Map<string, Array<brilInstruction>>();
    let label_order : Array<String> = ["start"];

    // Traverse each block and add it
    let curr_label : string = "start";
    let curr : Array<brilInstruction> = [];
    for (let insn of instrs) {

        // End block if it is a label or a terminator
        if (insn.label) {
            label_order.push(insn.label);
            if (curr.length > 0) {
                blocks.set(curr_label, curr);
            }
            curr_label = insn.label; // Update new label
            curr = [insn];
        } else if (insn.op) {
            curr.push(insn);
            if (insn.op == "jmp" || insn.op == "br") {
                blocks.set(curr_label, curr);
                curr = [];
                curr_label = ""; // Until we have a new starting label, treat as dead code
            }
        } else {
            curr.push(insn);
        }
    }
    blocks.set(curr_label, curr);

    if (blocks.has("")) {
        blocks.delete("");
    }
    
    return blocks;
}

const buildGraph = (blocks : Array<block>) : graph => {
    return new Map<String, Array<String>>();
}