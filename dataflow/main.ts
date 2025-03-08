import {basicBlocks, generateCFG} from "../common/basicBlockCFG.ts";
import { readStdin, runBril2Json } from "../common/commandLine.ts";
import {Graph} from "../common/graph.ts";
import {BlockMap, brilInstruction, brilProgram} from "../common/looseTypes.ts";
type Block = string;

/* Maps constant-folding opcodes to their relative functions */
const reduceMap = new Map<string, Function>([
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

const union = (s1: Set<any>, s2: Set<any>): Set<any> => {
    const result = new Set(s1)
    s2.forEach(elem => result.add(elem))
    return result
}

const unionMap = (m1: Map<any, any>, m2: Map<any, any>): Map<any, any> => {
    const result = new Map(m1)
    m2.forEach((v, k) => {
        if (result.has(k)) {
            if (result.get(k) !== v) {
                result.delete(k)
            }
        } else {
            result.set(k, v)
        }
    })
    return result
}

/* Implementation of the worklist algorithm for forward analyses. */
function worklist_forwards<Data>(graph: Graph, transfer: (a: Block, b: Data) => Data, merge: (data: Data[]) => Data, init: () => Data): Record<Block, Data>[] {
    /* Pseudocode
        in[entry] = init
        out[*] = init

        worklist = all blocks
        while worklist is not empty:
            b = pick any block from worklist
            out[b] = merge(in[p] for every successor p of b)
            in[b] = transfer(b, out[b])
            if in[b] changed:
                worklist += predecessors of b
    */
    const ins: Record<Block, Data> = {}
    const outs: Record<Block, Data> = {}

    const worklist: Block[] = graph.getVertices()

    while (worklist.length > 0) {
        const b = worklist.shift()!;
        const preds = graph.predecessors(b);
        ins[b] = merge(preds.map(p => outs[p] || init()))
        const prevOuts = outs[b]
        outs[b] = transfer(b, ins[b])
        if (JSON.stringify(prevOuts) != JSON.stringify(outs[b])) {
            worklist.push(...graph.successors(b))
        }
    }
    return [ins, outs]
}


/* Implementation of the worklist algorithm, going in reverse order. */
function worklist_backwards<Data>(graph: Graph, transfer: (a: Block, b: Data) => Data, merge: (data: Data[]) => Data, init: () => Data): Record<Block, Data>[] {
    /* Pseudocode
        out[entry] = init
        in[*] = init

        worklist = all blocks
        while worklist is not empty:
            b = pick any block from worklist
            in[b] = merge(out[p] for every predecessor p of b)
            out[b] = transfer(b, in[b])
            if out[b] changed:
                worklist += successors of b
    */
    const outs: Record<Block, Data> = {}
    const ins: Record<Block, Data> = {}

    const worklist: Block[] = graph.getVertices()

    while (worklist.length > 0) {
        const b = worklist.shift()!;
        const succs = graph.successors(b);
        outs[b] = merge(succs.map(b => ins[b] || init()))
        const prevIns = ins[b]
        ins[b] = transfer(b, outs[b])
        if (JSON.stringify(prevIns) != JSON.stringify(ins[b])) {
            // TODO
            worklist.push(...graph.predecessors(b))
        }
    }
    return [ins, outs]
}

/* Dataflow – Live Variable Analysis */
const lva = (graph: Graph, blocks: BlockMap) => {
    type data = Set<string>; // set of live variables

    /* Merge function */
    const merge = (blocks: data[]): data => {
        let result: data = new Set<string>();
        for (const block of blocks) {
            result = union(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, outs: data): data => {
        const ins: data = new Set(outs);
        for (const line of [...blocks.get(b)!].reverse()) {
            if (line.dest !== undefined) ins.delete(line.dest);
            if (line.args) for (const arg of line.args) ins.add(arg);
        }
        return ins;
    }

    return worklist_backwards<data>(graph, transfer, merge, () => new Set());
}

/* Dataflow – Reaching Definitions Analysis */
const reaching = (graph: Graph, blocks: BlockMap) => {
    type data = Set<brilInstruction>;

    /* Merge function */
    const merge = (blocks: data[]): data => {
        let result: data = new Set<brilInstruction>();
        for (const block of blocks) {
            result = union(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, ins: data): data => {
        const outs: data = new Set(ins);
        for (const line of blocks.get(b)!) {
            if (line.dest !== undefined) {
                for (const elem of outs) {
                    if (elem.dest === line.dest) {
                        outs.delete(elem);
                    }
                }
                outs.add(line);
            }
        }
        return outs;
    }

    return worklist_forwards<data>(graph, transfer, merge, () => new Set());
}

/* Dataflow – Constant Propagation (numbers/booleans) Analysis */
const constantProp = (graph: Graph, blocks: BlockMap) => {
    type data = Map<string, number | boolean>;

    /* Merge function (union with same key/values) */
    const merge = (blocks: data[]): data => {
        let result: data = new Map<string, number | boolean>();
        for (const block of blocks) {
            result = unionMap(result, block);
        }
        return result;
    }

    /* Transfer function */
    const transfer = (b: Block, ins: data): data => {
        const outs: data = new Map(ins);
        for (const line of blocks.get(b)!) {
            // If a definition is formed and uses only constants, add it
            if (line.dest && line.op) {
                if (reduceMap.has(line.op) && line.args) {
                    if (line.args.length == 2 &&
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
    return worklist_forwards<data>(graph, transfer, merge, () => new Map());
}

// deno-lint-ignore no-explicit-any
const format = (val: any): string => {
    if (val instanceof Set) {
        return val.size > 0 ? Array.from(val).join(", ") : "∅";
    } else if (val instanceof Map) {
        return val.size > 0
            ? Array.from(val.entries()).map(([k, v]) => `${k}: ${v}`).join(", ")
            : "∅";
    } else if (typeof val === "object" && val !== null) {
        return Object.keys(val).length > 0
            ? Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(", ")
            : "∅";
    } else {
        return val;
    }
};


/* Main function */
const main = async () => {
    const args = Deno.args; // Get command-line arguments

    let datastring = await readStdin();

    // Try to parse as JSON first
    try {
        JSON.parse(datastring);
    } catch {
        // If JSON parsing fails, assume it's Bril text representation and convert
        datastring = await runBril2Json(datastring);
    }

    const data: brilProgram = JSON.parse(datastring);
    const result: brilProgram = {functions: []};
    const analysisType = args[0]

    for (const fn of data.functions || []) {
        if (result.functions) {
            const blocks = basicBlocks(fn.instrs ?? [],false)
            const graph = generateCFG(blocks);

            let analysisResult;
            switch (analysisType) {
                case "live":
                    analysisResult = lva(graph, blocks);
                    break;
                case "reaching":
                    analysisResult = reaching(graph, blocks);
                    break;
                case "cprop":
                    analysisResult = constantProp(graph, blocks);
                    break;
                default:
                    console.error("Invalid analysis type.");
                    Deno.exit(1);
            }

            const [ins, outs] = analysisResult;
            for (const block of blocks) {
                const [name, _] = block;
                console.log(`${name}:`);
                console.log("  in: ", format(ins[name]));
                console.log("  out:", format(outs[name]));
            }
        }
    }
};

if (import.meta.main) {
    main();
}
