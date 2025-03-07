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
export type env = Map<string, string[]>;

export class Graph {
  private vertices: Set<string>;
  private edges: Map<string, string[]>;

  constructor(initialVertices: string[]) {
    this.vertices = new Set(initialVertices);
    this.edges = new Map(initialVertices.map((v) => [v, []]));
  }

  addEdge(from: string, to: string) {
    if (!this.vertices.has(from)) {
      this.vertices.add(from);
      this.edges.set(from, []);
    }
    if (!this.vertices.has(to)) {
      this.vertices.add(to);
      this.edges.set(to, []);
    }
    this.edges.get(from)!.push(to);
  }

  getVertices() {
    return [...this.vertices];
  }

  successors(vertex: string) {
    return this.edges.get(vertex)!;
  }

  predecessors(vertex: string): string[] {
    const preds: string[] = [];
    for (const [v, neighbors] of this.edges) {
      if (neighbors.includes(vertex)) {
        preds.push(v);
      }
    }
    return preds;
  }

  public toSortedJSON() {
    const sortedVertices = Array.from(this.vertices).sort();
    const sortedEdges: { [key: string]: string[] } = {};
    Array.from(this.edges.keys())
      .sort()
      .forEach((key) => {
        sortedEdges[key] = this.edges.get(key)!.slice().sort();
      });

    const result = {
      vertices: sortedVertices,
      edges: sortedEdges,
    };

    return JSON.stringify(result, null, 2);
  }
}

/* Convert Bril text programs into JSON representation using bril2json */
export const runBril2Json = async (datastring: string): Promise<string> => {
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

/* Convert Bril JSON programs into text representation */
export const runBril2Txt = async (program: brilProgram): Promise<string> => {
  const process = new Deno.Command("bril2txt", {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const child = process.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify(program)));
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
export const basicBlocks = (
  instrs: Array<brilInstruction>,
): [Map<string, Array<brilInstruction>>, Array<string>] => {
  // Store all labeled blocks
  let blocks: Map<string, brilInstruction[]> = new Map<
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
      curr = [];
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

  const entryBlock = label_order[0];
  const isEntryTargeted = blocks.entries().some(([_, insns]) => {
    return insns.at(-1)?.labels?.includes(entryBlock);
  });
  // TODO kabir i guess check this
  if (isEntryTargeted) {
    let i: number = 1;
    while (blocks.has("entry" + i)) i += 1;
    const newEntry = "entry" + i;
    const oldBlocks = blocks;
    blocks = new Map<string, brilInstruction[]>();
    blocks.set(newEntry, []);
    for (const [k, v] of oldBlocks) blocks.set(k, v);
    label_order.unshift(newEntry);
  }

  // TODO why do we have a dangling lbl0?
  return [blocks, label_order];
};

/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
export const generateCFG = (
  blocks: blockList,
  labels: string[],
): Graph => {
  const g = new Graph(labels);
  for (const [label, insns] of blocks) {
    const finalLabels = insns.at(-1)?.labels;
    if (finalLabels) {
      finalLabels.forEach((succ) => {
        g.addEdge(label, succ);
      });
    } else {
      const idx = labels.indexOf(label);
      if (idx != -1 && idx != labels.length - 1) {
        g.addEdge(label, labels[idx + 1]);
      }
    }
  }

  // /* If the first block has no in-edges, don't do anything.
  //   If there are, then add a fresh entry block pointing to the actual first element. */
  // let into_first: boolean = false;
  // for (let node of g.getVertices()) {
  //   if (g.successors(node)!.includes(blocks.keys().toArray()[0])) {
  //     into_first = true;
  //   }
  // }
  //
  // if (into_first) {
  //   let i: number = 1;
  //   while (g.getVertices().includes("entry" + i)) i += 1;
  //   g.addEdge("entry" + i, blocks.keys().toArray()[0] || "")
  // }
  return g;
};

export const CFGs = async (brildata: string) => {
  try {
    JSON.parse(brildata);
  } catch {
    brildata = await runBril2Json(brildata);
  }

  const data: brilProgram = JSON.parse(brildata);

  const ret: Record<string, Graph> = {};
  for (const fn of data.functions || []) {
    const [blocks, labelOrdering] = basicBlocks(fn.instrs ?? []);
    ret[fn.name!] = generateCFG(blocks, labelOrdering);
  }
  return ret;
};

export const readStdin = async (): Promise<string> => {
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

export const bigIntersection = <T>(sets: Set<T>[]): Set<T> => {
  if (sets.length === 0) return new Set();
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    result = new Set([...result].filter((x) => sets[i].has(x)));
  }
  return result;
};

export const setEquals = <T>(setA: Set<T>, setB: Set<T>): boolean => {
  if (setA.size != setB.size) return false;
  for (const elem of setA) {
    if (!setB.has(elem)) return false;
  }
  return true;
};

export const mapInv = (
  map: Map<string, Set<string>>,
): Map<string, Set<string>> => {
  const out = new Map<string, Set<string>>();
  for (const key of map.keys()) out.set(key, new Set());
  for (const [node, successors] of map.entries()) {
    for (const s of successors) out.get(s)!.add(node);
  }
  return out;
};

export const prettyPrint = (map: Map<any, any>) => {
  const obj = Object.fromEntries(
      Array.from(
          map,
          ([key, valueSet]) => [key, Array.from(valueSet).sort()],
      ),
  );

  const sortedObj = Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {} as { [key: string]: any });

  console.log(JSON.stringify(sortedObj, null, 2));
};
