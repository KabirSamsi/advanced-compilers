import { basicBlocks, CFGs, generateCFG } from "../common/basicBlockCFG.ts";
import {
  BlockMap,
  brilInstruction,
  brilProgram,
} from "../common/looseTypes.ts";
import { dominanceFrontier, dominanceTree } from "../dominance/main.ts";
import { Graph } from "../common/graph.ts";
import {
  prettyPrint,
  readStdin,
  runBril2Json,
  runBril2Txt,
} from "../common/commandLine.ts";

/* Find the list of all basic blocks with one entry point
    @param – 
*/
const findLoopStarts = ((cfg : Graph) : Set<string> => {
    const entries : Set<string> = new Set<string>();
    for (const vertex of cfg.getVertices()) {
        if (cfg.predecessors(vertex).length == 1) {
            entries.add(vertex);
        }
    }
    return entries;
})


// Auxiliar function for Tarjan's Strongly Connected Components Algorithm
const aux = ((cfg : Graph, vertex : string, time : number, disc: Map<string, number>, earliest : Map<string, number>, stackMember : Map<string, boolean>, st : string[]) : string[] => {
    disc.set(vertex, time);
    earliest.set(vertex, time);
    stackMember.set(vertex, true);
    st.push(vertex);

    for (let neighbor of cfg.successors(vertex)) {
        if (disc.get(neighbor)! != -1) {
            aux(cfg, neighbor, time+1, disc, earliest, stackMember, st);
            earliest.set(vertex, Math.min(earliest.get(vertex)!, earliest.get(neighbor)!));
        } else if (stackMember.get(neighbor)!) {
            earliest.set(vertex, Math.min(earliest.get(vertex)!, earliest.get(neighbor)!));
        }
    }
    return [];
})

// Implementation of Tarjan's Strongly Connected Components Algorithm.
const findLoops = ((cfg : Graph) : string[][] => {
    const disc : Map<string, number> = new Map(cfg.getVertices().map(v => [v, -1]));
    const earliest : Map<string, number> = new Map(cfg.getVertices().map(v => [v, -1]));
    const stackMember : Map<string, boolean> = new Map(cfg.getVertices().map(v => [v, false]));
    const st : string[] = [];
    const loops : string[][] = [];

    for (const vertex of findLoopStarts(cfg)) {
        if (disc.get(vertex)! == -1) {
            loops.push(aux(cfg, vertex, 0, disc, earliest, stackMember, st));
        }
    }
    return loops;
})