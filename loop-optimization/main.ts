import { basicBlocks, CFGs, generateCFG } from "../common/basicBlockCFG.ts";
import {
  BlockMap,
  brilInstruction,
  brilProgram,
} from "../common/looseTypes.ts";
import { computeDominators, dominanceFrontier, dominanceTree } from "../dominance/main.ts";
import { Graph } from "../common/graph.ts";
import {
  prettyPrint,
  readStdin,
  runBril2Json,
  runBril2Txt,
} from "../common/commandLine.ts";

/*
* Compute the back-edges in a CFG via a breadth-first search traversal
* @param CFG – the control-flow graph
* @param entry – The entry to the CFG
* @return – A map mapping all vertices to the nodes to which they have backedges
*/
const backEdges = ((cfg: Graph) : Map<string, Set<string>> => {
    const dominators : Map<string, Set<string>> = computeDominators(cfg);
    const backEdges : Map<string, Set<string>> = new Map<string, Set<string>>();

    for (let vertex of cfg.getVertices()) {
        let edges : Set<string> = new Set<string>();
        for (let dominator of dominators.get(vertex)?? new Set()) {
            if (cfg.successors(vertex).includes(dominator)) {
                edges.add(dominator);
            }
        }
        backEdges.set(vertex, edges);
    }
    return backEdges;
})

/* Compute the loop around a back edge
* @param cfg – The Control-flow graph
* @param v – The dominated vertex from which the backedge starts
* @param u – The dominator vertex to whic hteh backedge goes
* @return – A set of all elements in in the contained loop
*/
const loopAroundBackEdge = ((cfg : Graph, v : string, u : string) : Set<string> => {
    let queue : string[] = [v]
    const visited : Set<string> = new Set([v]);
    let result : Set<string> = new Set([u]);
    while (queue.length > 0) {
        let front : string = queue.shift()!;
        result.add(front);
        for (const pred of cfg.predecessors(front)) {
            if (!visited.has(pred) && pred != u) {
                visited.add(pred);
                queue.push(pred);
            }
        }
    }
    return result;
})

/* Compute all natural loops in a CFG
* @param cfg – the Control-Flow Graph
* @param backEdges – The (previously computed) backedges in the graph
* @return – An array of each loop, represented by the set of block labels it encompasses
*/
const naturalLoops = ((cfg : Graph, backEdges : Map<string, Set<string>>) : Set<string>[] => {
    const loops : Set<string>[] = [];
    for (const [v, us] of backEdges) {
        for (let u of us) {
            loops.push(loopAroundBackEdge(cfg, v, u));
        }
    }
    return loops;
})

/*
    Auxiliary function for Tarjan's Strongly Connected Components Algorithm.
    @param cfg – the Control-Flow Graph
    @param vertex – The relevant node of the CFG
    @param time – State reference to the current time
    @param disc – Mapping vertices to their discovery time
    @param earliest – Mapping vertices to the earliest discovery time in their given SCC
    @param stackMember – Checks stack membership for each vertex
    @param stack - Tracks elements in DFS traversal
    @param loops – Series of components, each one containing the relevant blocks per loop

    @return – Nothing.
*/
const aux = ((cfg : Graph, vertex : string, time : { value: number}, disc: Map<string, number>, earliest : Map<string, number>, stackMember : Map<string, boolean>, st : string[], loops : string[][]) => {
    disc.set(vertex, time.value);
    earliest.set(vertex, time.value);
    stackMember.set(vertex, true);
    st.push(vertex);
    time.value += 1;

    // Recurse through neighbors
    for (let neighbor of cfg.successors(vertex)) {
        if (disc.get(neighbor)! == -1) {
            aux(cfg, neighbor, time, disc, earliest, stackMember, st, loops);
            earliest.set(vertex, Math.min(earliest.get(vertex)!, earliest.get(neighbor)!));
        } else if (stackMember.get(neighbor)!) {
            earliest.set(vertex, Math.min(earliest.get(vertex)!, earliest.get(neighbor)!));
        }
    }

    // Propagate and return if head of component is found.
    const result : string[] = [];
    if (earliest.get(vertex) == disc.get(vertex)) {
        let w : string;
        do {
            w = st.pop()!;
            result.push(w);
            stackMember.set(w, false);
        } while (w !== vertex);
        if (result.length > 0) {
            loops.push(result);
        }
    }
})


/*
    Compute all loops as strongly connected components of the CFG, using Tarjan's Algorithm for SCCs.
    @param cfg – the Control-Flow Graph
    @return – Set of computed loops.
*/
const findLoops = ((cfg : Graph) : string[][] => {
    const time = { value: 0 };
    const disc : Map<string, number> = new Map(cfg.getVertices().map(v => [v, -1]));
    const earliest : Map<string, number> = new Map(cfg.getVertices().map(v => [v, -1]));
    const stackMember : Map<string, boolean> = new Map(cfg.getVertices().map(v => [v, false]));
    const st : string[] = [];
    const loops : string[][] = [];

    for (const vertex of cfg.getVertices()) {
        if (disc.get(vertex)! == -1) {
            aux(cfg, vertex, time, disc, earliest, stackMember, st, loops);
        }
    }
    return loops;
})

/* Main functionality */
const main = async (stdin) => {
    try {
        JSON.parse(stdin);
    }
    catch {
        stdin = await runBril2Json(stdin);
    }
    const program = JSON.parse(stdin);
    for (const fn of program.functions || []) {
        console.log(fn.name?? "");
        if (fn.instrs) {
            const blocks = basicBlocks(fn.instrs);
            const cfg = generateCFG(blocks);
            Array.from(blocks.values()).flat();
            const back : Map<string, Set<string>> = backEdges(cfg);
            const loops : Set<string>[] = naturalLoops(cfg, back);
            console.log(loops);
        }
    }
    // for JSON output
    // const text = await runBril2Txt(program);
}

if (import.meta.main) {
    const datastring = await readStdin();
    main(datastring);
}