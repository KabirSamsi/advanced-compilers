// Bril instruction type
export type brilInstruction = {
  label?: string;
  dest?: string;
  op?: string;
  args?: string[];
  functions?: string[];
  labels?: string[];
  value?: any;
  type?: any;
};

// Bril function type
export type brilFunction = {
  instrs?: brilInstruction[];
  name?: string;
  args?: string[];
  type?: string;
};

// Other auxiliary types
export type brilProgram = { functions?: brilFunction[] };
export type blockList = Map<string, brilInstruction[]>;
export type graph = Map<string, string[]>;
export type Block = string;

/* Convert Bril text programs into JSON representation using bril2json */
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

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
const basicBlocks = (
  instrs: Array<brilInstruction>,
): [Map<string, Array<brilInstruction>>, Array<string>] => {
  // Store all labeled blocks
  const blocks: Map<string, brilInstruction[]> = new Map<
    string,
    Array<brilInstruction>
  >();
  const label_order: string[] = [];
  let label_count: number = 0;

  // Traverse each block and add it
  let curr_label: string = "";
  let curr: Array<brilInstruction> = [];
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
};

/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
const generateCFG = (blocks: blockList, labels: string[]): graph => {
  const graph: graph = new Map();
  for (const [label, insns] of blocks) {
    if (insns.length > 0 && insns[insns.length - 1].labels) {
      const tail = insns[insns.length - 1].labels || [];
      graph.set(label, tail);
    } else {
      const idx = labels.indexOf(label);
      if (idx != -1 && idx != labels.length - 1) {
        graph.set(label, [labels[idx + 1]]);
      } else {
        graph.set(label, []);
      }
    }
  }
  return graph;
};

export const CFGs = async (brildata: string) => {
  try {
    JSON.parse(brildata);
  } catch {
    brildata = await runBril2Json(brildata);
  }

  const data: brilProgram = JSON.parse(brildata);

  const ret: Record<string, graph> = {};
  for (const fn of data.functions || []) {
    const [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
    const graph = generateCFG(blocks, labelOrdering);
    ret[fn.name!] = graph;
  }
  return ret;
};

/* Extract successors of a block (indexed by label) in a CFG. */
const succ = (adj: graph, node: string): string[] => {
  return adj.get(node) || [];
};

/* Extract predecessors of a block (indexed by label) in a CFG. */
const pred = (adj: graph, node: string): string[] => {
  const predecessors: string[] = [];
  for (const neighbor of adj.keys()) {
    if ((adj.get(neighbor) || []).includes(node)) {
      predecessors.push(neighbor);
    }
  }
  return predecessors;
};
