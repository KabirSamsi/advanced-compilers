import {
  basicBlocks,
  brilInstruction,
  brilProgram,
  env,
  generateCFG,
  Graph,
  prettyPrint,
  readStdin,
  runBril2Json,
  runBril2Txt,
} from "./util.ts";
import { dominanceFrontier } from "./dominance.ts";

/**
 * Returns a map from each defined variable in a function to the blocks that defined it
 * @param blocks basic blocks
 */
const defSources = (blocks: Map<string, brilInstruction[]>) => {
  const map = new Map<string, Set<string>>();
  for (const [label, insns] of blocks) {
    for (const insn of insns) {
      if (insn.dest) {
        const dest = insn.dest;
        if (!map.has(dest)) map.set(dest, new Set());
        map.get(dest)!.add(label);
      }
    }
  }
  return map;
};

const insertSets = (block: brilInstruction[]): brilInstruction[] => {
  let updatedBlock: brilInstruction[] = [];
  for (const insn of block) {
    updatedBlock.push(insn);
    if (insn.dest) {
      updatedBlock.push({ op: insn.dest! });
    }
  }
  return [];
};

const outOfSSA = (blocks: Map<string, brilInstruction[]>) => {
  blocks.forEach((block, label, map) => {
    const newBlock = block
        .filter(insn => insn.op !== "get")
        .map(insn => {
          if (insn.op === "set") {
            const [dest, src] = insn.args!;
            return {
              dest,
              args: [src],
              op: "id",
              type: undefined,
            };
          }
          return insn;
        });
    map.set(label, newBlock);
  });
};

const main = async (stdin: string, preservePhiNodes: boolean) => {
  try {
    JSON.parse(stdin);
  } catch {
    stdin = await runBril2Json(stdin);
  }
  const program: brilProgram = JSON.parse(stdin);

  for (const fn of program.functions || []) {
    if (fn.instrs) {
      const [blocks, labelOrdering]: [
        Map<string, brilInstruction[]>,
        Array<string>,
      ] = basicBlocks(fn.instrs);
      const cfg: Graph = generateCFG(blocks, labelOrdering);
      const domTree = dominanceFrontier(cfg);
      const definitions = defSources(blocks);
      let shadow: env = new Map();

      /*
       * Add in all set nodes in one pass through each basic block; updated shadow environment
       */

      // Out of SSA from Pizlo’s Upsilon/Phi Variant
      if (!preservePhiNodes) {
        outOfSSA(blocks);
      }
      fn.instrs = Array.from(blocks.values()).flat();
    }
  }

  // for JSON output
  // console.log(JSON.stringify(program,null, 2));
  const text = await runBril2Txt(program);
  // console.log(text);
};

if (import.meta.main) {
  const datastring = await readStdin();
  main(datastring, Deno.args[0] === "phi");
}
