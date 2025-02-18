// Bril program types
type brilInstruction = {
    label?: string
    dest?: string
    op?: string
    args?: string[],
    functions?: string[],
    labels?: string[],
    value?: any,
    type?: any
};

type brilFunction = {
    instrs?: brilInstruction[]
    name?: string
    args?: string[],
    type?: string
};

type brilProgram = {functions?: brilFunction[]};

type blockList = Map<string, brilInstruction[]>;

type graph = Map<string, string[]>;

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
const basicBlocks = (instrs : Array<brilInstruction>) : [Map<string, Array<brilInstruction>>, Array<string>] => {
    // Store all labeled blocks
    const blocks : Map<string, brilInstruction[]> = new Map<string, Array<brilInstruction>>();
    const label_order : string[] = ["start"];

    // Traverse each block and add it
    let curr_label : string = "start";
    let curr : Array<brilInstruction> = [];
    for (const insn of instrs) {

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

    return [blocks, label_order];
}

/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
const generateCFG = (blocks : blockList, labels : string[]) : graph => {
    const graph : graph = new Map();
    for (const [label, insns] of blocks) {
        if (insns.length > 0 && insns[insns.length-1].labels) {
            const tail = insns[insns.length-1].labels || [];
            graph.set(label, tail);
        } else {
            const idx = labels.indexOf(label);
            if (idx != -1 && idx != labels.length-1) {
                graph.set(label, [labels[idx+1]]);
            } else {
                graph.set(label, []);
            }
        }
    }
    return graph;
}

/*
    Main function.
    Open a file specified from the command line and run each function through DCE and LVN passes.
*/
const main = async () => {
    const stdin = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .getReader();

    let datastring = "";
    while (true) {
        const { value, done } = await stdin.read();
        if (done) break;
        datastring += value;
    }

    try {
        const data: brilProgram = JSON.parse(datastring);
        const result: brilProgram = { functions: [] };

        for (const fn of data.functions || []) {
            if (result.functions) {
                const [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
                const graph = generateCFG(blocks, labelOrdering);
                console.log(graph);
            }
        }
    } catch (error) {
        console.error("Invalid JSON:", error);
    }
};

if (import.meta.main) {
    main();
}