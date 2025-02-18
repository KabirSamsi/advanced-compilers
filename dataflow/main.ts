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

type blockList = Map<string, Array<brilInstruction>>;

type graph = Map<string, Array<string>>;

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
const basicBlocks = (instrs : Array<brilInstruction>) : [Map<string, Array<brilInstruction>>, Array<string>] => {
    // Store all labeled blocks
    let blocks : Map<string, Array<brilInstruction>> = new Map<string, Array<brilInstruction>>();
    let label_order : Array<string> = ["start"];

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

    return [blocks, label_order];
}

/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
const generateCFG = (blocks : blockList, labels : Array<string>) : graph => {
    let graph : graph = new Map<string, Array<string>>();
    for (let [label, insns] of blocks) {
        if (insns.length > 0 && insns[insns.length-1].labels) {
            let tail : Array<string> = insns[insns.length-1].labels || [];
            graph.set(label, tail);
        } else {
            let idx : number = labels.indexOf(label);
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
                let [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
                let graph = generateCFG(blocks, labelOrdering);
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