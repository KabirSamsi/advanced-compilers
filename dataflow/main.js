/* Difference of two sets (less experimental technology) */
const difference = (s1, s2) => {
    s2.forEach(elem => {
        s1.add(elem);
        s1.delete(elem);
    });
    return s1;
};
/* Difference of two sets (less experimentla technology) */
const union = (s1, s2) => {
    s2.forEach(elem => s1.add(elem));
    return s1;
};
/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
const basicBlocks = (instrs) => {
    // Store all labeled blocks
    const blocks = new Map();
    const label_order = [];
    let label_count = 0;
    // Traverse each block and add it
    let curr_label = "";
    let curr = [];
    for (const insn of instrs) {
        // End block if it is a label or a terminator
        if (insn.label) {
            if (curr.length > 0) {
                if (curr_label == "") {
                    blocks.set("lbl" + label_count, curr);
                    label_count += 1;
                    label_order.push("lbl" + label_count);
                }
                else {
                    blocks.set(curr_label, curr);
                    label_order.push(curr_label);
                }
            }
            curr_label = insn.label; // Update new label
        }
        else if (insn.op) {
            curr.push(insn);
            if (insn.op == "jmp" || insn.op == "br" || insn.op == "ret") {
                if (curr_label == "") {
                    blocks.set("lbl" + label_count, curr);
                    label_count += 1;
                    label_order.push("lbl" + label_count);
                }
                else {
                    blocks.set(curr_label, curr);
                    label_order.push(curr_label);
                }
                curr = [];
                curr_label = ""; // Until we have a new starting label, treat as dead code
            }
        }
        else {
            curr.push(insn);
        }
    }
    if (curr_label == "") {
        blocks.set("lbl" + label_count, curr);
        label_count += 1;
        label_order.push("lbl" + label_count);
    }
    else {
        blocks.set(curr_label, curr);
        label_order.push(curr_label);
    }
    return [blocks, label_order];
};
/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
const generateCFG = (blocks, labels) => {
    const graph = new Map();
    for (const [label, insns] of blocks) {
        if (insns.length > 0 && insns[insns.length - 1].labels) {
            const tail = insns[insns.length - 1].labels || [];
            graph.set(label, tail);
        }
        else {
            const idx = labels.indexOf(label);
            if (idx != -1 && idx != labels.length - 1) {
                graph.set(label, [labels[idx + 1]]);
            }
            else {
                graph.set(label, []);
            }
        }
    }
    return graph;
};
/* Extract successors of a block (indexed by label) in a CFG. */
const succ = (adj, node) => {
    return adj.get(node) || [];
};
/* Extract predecessors of a block (indexed by label) in a CFG. */
const pred = (adj, node) => {
    let predecessors = [];
    for (let neighbor of adj.keys()) {
        if ((adj.get(neighbor) || []).includes(node)) {
            predecessors.push(neighbor);
        }
    }
    return predecessors;
};
/* Implementation of the worklist algorithm. */
function worklist_forwards(graph, transfer, merge) {
    /* Pseudocode
    in[entry] = init
    out[*] = init

    worklist = all blocks
    while worklist is not empty:
        b = pick any block from worklist
        in[b] = merge(out[p] for every predecessor p of b)
        out[b] = transfer(b, in[b])
        if out[b] changed:
            worklist += successors of b
*/
    const ins = {};
    const outs = {};
    const worklist = [...graph.keys()];
    // Iterate backwards
    while (worklist.length > 0) {
        const b = worklist.shift();
        const succs = graph.get(b) ?? [];
        outs[b] = merge(succs.map(b => ins[b] || new Set()));
        const prevIns = ins[b];
        ins[b] = transfer(b, outs[b]);
        if (prevIns != ins[b]) { // no clue if this will work
            worklist.concat(pred(graph, b));
        }
    }
    return [ins, outs];
}
/* Implementation of the worklist algorithm, going in reverse order. */
function worklist_backwards(graph, transfer, merge) {
    /* Pseudocode
    in[entry] = init
    out[*] = init

    worklist = all blocks
    while worklist is not empty:
        b = pick any block from worklist
        in[b] = merge(out[p] for every predecessor p of b)
        out[b] = transfer(b, in[b])
        if out[b] changed:
            worklist += successors of b
*/
    const outs = {};
    const ins = {};
    const worklist = [...graph.keys()];
    // Iterate backwards
    while (worklist.length > 0) {
        const b = worklist.shift();
        const succs = graph.get(b) ?? [];
        outs[b] = merge(succs.map(b => ins[b] || new Set()));
        const prevIns = ins[b];
        ins[b] = transfer(b, outs[b]);
        if (prevIns != ins[b]) { // no clue if this will work
            worklist.concat(pred(graph, b));
        }
    }
    return [ins, outs];
}
// Local Variable Analysis – Backwards Iteration
const lva = (graph, blocks) => {
    /* Merge function */
    const merge = (blocks) => {
        let result = new Set();
        for (let block of blocks) {
            result = union(result, block);
        }
        return result;
    };
    /* Transfer function */
    const transfer = (b, out) => {
        let ins = out;
        for (let line of blocks.get(b).reverse()) {
            if (line.dest != undefined) {
                ins.delete(line.dest);
            }
            let uses = new Set((line.args || []));
            ins = union(ins, uses);
        }
        return ins;
    };
    return worklist_backwards(graph, transfer, merge);
};
const runBril2Json = async (datastring) => {
    const process = new Deno.Command("bril2json", {
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
    });
    const child = process.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(datastring));
    await writer.close();
    const { stdout, stderr } = await child.output();
    if (stderr.length > 0) {
        console.error("Error running bril2json:", new TextDecoder().decode(stderr));
        Deno.exit(1);
    }
    return new TextDecoder().decode(stdout);
};
const readStdin = async () => {
    const stdin = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .getReader();
    let datastring = "";
    while (true) {
        const { value, done } = await stdin.read();
        if (done)
            break;
        datastring += value;
    }
    return datastring.trim();
};
const main = async () => {
    let datastring = await readStdin();
    // Try to parse as JSON first
    try {
        JSON.parse(datastring);
    }
    catch {
        // If parsing fails, assume it's Bril source and convert
        datastring = await runBril2Json(datastring);
    }
    const data = JSON.parse(datastring);
    const result = { functions: [] };
    for (const fn of data.functions || []) {
        if (result.functions) {
            const [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
            const graph = generateCFG(blocks, labelOrdering);
            console.log(blocks);
            console.log(graph);
            const [ins, outs] = lva(graph, blocks);
            for (const block of blocks) {
                const [name, _] = block;
                console.log(name + ":");
                console.log(ins[name]);
                console.log(outs[name]);
            }
        }
    }
};
if (import.meta.main) {
    main();
}
;
export {};
//# sourceMappingURL=main.js.map