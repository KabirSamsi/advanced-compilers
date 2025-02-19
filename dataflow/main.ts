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

type Block = string;

// Maps constant-folding opcodes to their relative functions
const reduceMap : Map<string, Function> = new Map<string, Function>([
    ["add", (x : number, y : number) => x+y],
    ["mul", (x : number, y : number) => x*y],
    ["sub", (x : number, y : number) => x-y],
    ["eq", (x : number, y : number) => x == y],
    ["ne", (x : number, y : number) : boolean => x != y],
    ["le", (x : number, y : number) : boolean => x <= y],
    ["ge", (x : number, y : number) : boolean => x >= y],
    ["lt", (x : number, y : number) : boolean => x < y],
    ["gt", (x : number, y : number) : boolean => x > y],
    ["and", (x : boolean, y : boolean) : boolean => x && y],
    ["or", (x : boolean, y : boolean) : boolean => x || y],
]);

/* Difference of two sets (less experimental technology) */
const difference = (s1 : Set<any>, s2 : Set<any>) : Set<any> => {
    s2.forEach(elem => {
        s1.add(elem);
        s1.delete(elem);
    })
    return s1;
}

/* Difference of two sets */
const union = (s1 : Set<any>, s2 : Set<any>) : Set<any> => {
    s2.forEach(elem => s1.add(elem));
    return s1;
}

/* Intersection of two maps, only if their values are equivalent */
const intersection = (s1 : Map<any, any>, s2 : Map<any, any>) : Map<any, any> => {
    let result : Map<any, any> = new Map<any, any>();

    for (let key of s1) {
        if (s2.has(key)) {
            if (s2.get(key) == s1.get(key)) {
                result.set(key, s1.get(key));
            }
        }
    }
    return result;
}

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
const basicBlocks = (instrs : Array<brilInstruction>) : [Map<string, Array<brilInstruction>>, Array<string>] => {
    // Store all labeled blocks
    const blocks : Map<string, brilInstruction[]> = new Map<string, Array<brilInstruction>>();
    const label_order : string[] = [];
    let label_count : number = 0;

    // Traverse each block and add it
    let curr_label : string = "";
    let curr : Array<brilInstruction> = [];
    for (const insn of instrs) {

        // End block if it is a label or a terminator
        if (insn.label) {
            if (curr.length > 0) {
                if (curr_label == "") {
                    blocks.set("lbl" + label_count, curr);   
                    label_count += 1;
                    label_order.push("lbl" + label_count);
                } else {
                    blocks.set(curr_label, curr);
                    label_order.push(curr_label);
                }
            }
            curr_label = insn.label; // Update new label
        } else if (insn.op) {
            curr.push(insn);
            if (insn.op == "jmp" || insn.op == "br" || insn.op == "ret") {
                if (curr_label == "") {
                    blocks.set("lbl" + label_count, curr);   
                    label_count += 1;
                    label_order.push("lbl" + label_count);
                } else {
                    blocks.set(curr_label, curr);
                    label_order.push(curr_label);
                }
                curr = [];
                curr_label = ""; // Until we have a new starting label, treat as dead code
            }
        } else {
            curr.push(insn);
        }
    }

    if (curr_label == "") {
        blocks.set("lbl" + label_count, curr);   
        label_count += 1;
        label_order.push("lbl" + label_count);
    } else {
        blocks.set(curr_label, curr);
        label_order.push(curr_label);
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

/* Extract successors of a block (indexed by label) in a CFG. */
const succ = (adj : graph, node : string) : string[] => {
    return adj.get(node) || [];
}

/* Extract predecessors of a block (indexed by label) in a CFG. */
const pred = (adj : graph, node : string) : string[] => {
    let predecessors : string[] = [];
    for (let neighbor of adj.keys()) {
        if ((adj.get(neighbor) || []).includes(node)) {
            predecessors.push(neighbor);
        }
    }
    return predecessors;
}

/* Implementation of the worklist algorithm. */
function worklist_forwards<Data>(graph : graph, transfer, merge) : Record<Block, Data>[] {
    /* Pseudocode – reverse idea of previous function. */
    const ins : Record<Block, Data> = {}    
    const outs : Record<Block, Data> = {}

    const worklist : Block[] = [...graph.keys()]

    while (worklist.length > 0) {
        const b = worklist.shift()!;
        const succs = graph.get(b) ?? []
        ins[b] = merge(succs.map(b => outs[b] || new Set()))
        const prevOuts = outs[b]
        outs[b] = transfer(b, ins[b])
        if (prevOuts != outs[b]) { // no clue if this will work
            worklist.concat(succ(graph, b))
        }
    }
    return [ins, outs]
}


/* Implementation of the worklist algorithm, going in reverse order. */
function worklist_backwards<Data>(graph, transfer, merge) : Record<Block, Data>[] {
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
    const outs : Record<Block, Data> = {}
    const ins : Record<Block, Data> = {}

    const worklist : Block[] = [...graph.keys()]

    while (worklist.length > 0) {
        const b = worklist.shift()!;
        const succs = graph.get(b) ?? []
        outs[b] = merge(succs.map(b => ins[b] || new Set()))
        const prevIns = ins[b]
        ins[b] = transfer(b, outs[b])
        if (prevIns != ins[b]) { // no clue if this will work
            worklist.concat(pred (graph, b))
        }
    }
    return [ins, outs]
}

// Live Variable Analysis
const lva = (graph : graph, blocks : blockList) => {
    type data = Set<string>; // set of live variables

    /* Merge function */
    const merge = (blocks: data[]): data => {
        let result : data = new Set<string>();
        for (let block of blocks) {
            result = union(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, outs: data) : data => {
        let ins : data = outs;
        for (let line of blocks.get(b)!.reverse()) {
            if (line.dest != undefined) {
                ins.delete(line.dest!);
            }
            let uses : data = new Set((line.args || []));
            ins = union(ins, uses);
        }
        return ins;
    }

    return worklist_backwards<data>(graph, transfer, merge);
}

// Reaching Definitions Analysis
const reaching = (graph : graph, blocks : blockList) => {
    type data = Set<brilInstruction>; // set of live variables

    /* Merge function */
    const merge = (blocks: data[]): data => {
        let result : data = new Set<brilInstruction>();
        for (let block of blocks) {
            result = union(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, ins: data) : data => {
        let outs : data = ins;
        for (let line of blocks.get(b)!) {
            // If a definition is formed
            if (line.dest != undefined) {
                for (let elem of outs) {
                    if (elem.dest! == line.dest) {
                        outs.delete(elem);
                        break;
                    }
                }
                outs.add(line);
            }
        }
        return ins;
    }

    return worklist_forwards<data>(graph, transfer, merge);
}

/* Constant propagation for numbers and booleans */
const constantProp = (graph : graph, blocks : blockList) => {
    type data = Map<string, number | boolean>; // set of live variables

    /* Merge function (set intersection) */
    const merge = (blocks: data[]): data => {
        let result : data = new Map<string, number | boolean>();
        for (let block of blocks) {
            result = intersection(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, ins: data) : data => {
        let outs : data = ins;
        for (let line of blocks.get(b)!) {
            // If a definition is formed and uses only constants, add it
            if (line.dest != undefined && line.op) {
                if (reduceMap.has(line.op) && line.args) {
                    if (line.args!.length == 2 &&
                        outs.has(line.args[0]) &&
                        outs.has(line.args[1])) {
                            outs.set(line.dest,
                                reduceMap.get(line.op)!(
                                    outs.get(line.args[0]),
                                    outs.get(line.args[1])
                                )
                            );
                    }
                // If the definition itself is a constant, add it as it is
                } else if (line.op == "const") {
                    outs.set(line.dest, line.value!);
                }
            }
        }
        return outs;
    }
    return worklist_forwards<data>(graph, transfer, merge);
}


const runBril2Json = async (datastring: string): Promise<string> => {
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

const readStdin = async (): Promise<string> => {
    const stdin = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .getReader();

    let datastring = "";
    while (true) {
        const { value, done } = await stdin.read();
        if (done) break;
        datastring += value;
    }
    return datastring.trim();
};

const main = async () => {
    let datastring = await readStdin();

    // Try to parse as JSON first
    try {
        JSON.parse(datastring);
    } catch {
        // If parsing fails, assume it's Bril source and convert
        datastring = await runBril2Json(datastring);
    }

        const data: brilProgram = JSON.parse(datastring);
        const result: brilProgram = { functions: [] };

        for (const fn of data.functions || []) {
            if (result.functions) {
                const [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
                const graph = generateCFG(blocks, labelOrdering);
                console.log(blocks);
                console.log(graph);
                const [ins,outs] = lva(graph,blocks);
                for(const block of blocks) {
                    const [name, _] = block
                    console.log(name+":")
                    console.log(ins[name])
                    console.log(outs[name])
                }
            }
        }
};

if (import.meta.main) {
    main();
};
