import {basicBlocks, brilProgram, CFGs, env, generateCFG, Graph, readStdin, runBril2Json, runBril2Txt} from "./util.ts";
import {dominanceFrontier} from "./dominance.ts";

const main = async (stdin: string, preservePhiNodes: boolean) => {
  try {
    JSON.parse(stdin);
  } catch {
    stdin = await runBril2Json(stdin);
  }
  const program: brilProgram = JSON.parse(stdin);

  for (const fn of program.functions || []) {
    if (fn.instrs) {
    const [blocks, labelOrdering] = basicBlocks(fn.instrs);
    const cfg: Graph = generateCFG(blocks, labelOrdering);
    const domTree = dominanceFrontier(cfg)
    let shadow : env = new Map();
    /*
      * Add in all set nodes in one pass through each basic block; updated shadow environment
      * 
    * */


    fn.instrs = Array.from(blocks.values()).flat();
    }
  }


  if (preservePhiNodes) {
  }
  // for JSON output
  // console.log(JSON.stringify(program,null, 2));
  const text = await runBril2Txt(program)
  console.log(text)
};

if (import.meta.main) {
  const datastring = await readStdin();
  main(datastring, Deno.args[0] === "phi");
}
