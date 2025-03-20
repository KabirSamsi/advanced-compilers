import { basicBlocks, CFGs, generateCFG } from "../common/basicBlockCFG.ts";
import { BlockMap,brilInstruction, brilProgram } from "../common/looseTypes.ts";
import { reaching } from "../dataflow/main.ts";
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

/* Compute all natural loops in a CFG, with their headers
* @param cfg – the Control-Flow Graph
* @param backEdges – The (previously computed) backedges in the graph
* @return – An array of each loop, represented by the set of block labels it encompasses
*/
const naturalLoops = ((cfg : Graph, backEdges : Map<string, Set<string>>) : [string, Set<string>][] => {
    const loops : [string, Set<string>][] = [];
    for (const [v, us] of backEdges) {
        for (let u of us) {
            loops.push([u, loopAroundBackEdge(cfg, v, u)]);
        }
    }
    return loops;
})

/* Generate fresh basic block into which we can move LICM code. */
const freshBlock = ((vertices : string[]) : string => {
    let i : number = 0;
    while (vertices.includes("block_" + i)) {
        i += 1;
    }
    return "block_" + i;
})

/* Perform a Loop-Invariant Code Motion Analysis */
const licm = ((cfg : Graph, blocks : BlockMap, loops : [string, Set<string>][]) => {
    // Create new block into which we can add LICM code
    const reachingDefinitions = reaching(cfg, blocks);

    for (let [header, loop] of loops) {
        let preds : string[] = cfg.predecessors(header);
        let prehead : string = freshBlock(cfg.getVertices());
        
        // Set new block which just jumps to new header element
        blocks.set(prehead, [{op : "jmp", labels: [header]}]);
        cfg.addEdge(prehead, header);
        for (let pred of preds) {
            // Update blocks to reflect this change
            cfg.removeEdge(pred, header);
            let block : brilInstruction[] = blocks.get(pred)!;
            if (block.length > 0 && block[block.length-1].labels) {
                block[block.length-1].labels = block[block.length-1].labels!.map(
                    nm => (nm == header) ? prehead : nm
                );
            }
            // After the block maintenance is done, add in new edge
            cfg.addEdge(pred, prehead);
        }

        // Mark all arguments which are loop-invariant
        let loopInvariant : Set<brilInstruction> = new Set<brilInstruction>();
        for (let blockname of loop) {
            for (let insn of blocks.get(blockname)?? []) {
                for (let arg of insn.args?? []) {
                    let definitions = reachingDefinitions[arg];
                    if (definitions.length == 1) {
                        if (loopInvariant.has(definitions[0])) {
                            loopInvariant.add(insn);
                            break;
                        }
                    } else {
                        for (const definition of reachingDefinitions[arg]) {
                            // WIP
                        }
                    }
                }
            }
        }
    }
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
            const loops : [string, Set<string>][] = naturalLoops(cfg, back);
            console.log(loops);
            // console.log(loops);
        }
    }
    // for JSON output
    // const text = await runBril2Txt(program);
}

if (import.meta.main) {
    const datastring = await readStdin();
    main(datastring);
}