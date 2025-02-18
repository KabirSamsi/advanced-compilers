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
};
