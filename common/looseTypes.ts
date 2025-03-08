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
export type brilFunction = {
    instrs?: brilInstruction[];
    name?: string;
    args?: string[];
    type?: string;
};
export type brilProgram = { functions?: brilFunction[] };
export type BlockMap = Map<string, brilInstruction[]>;