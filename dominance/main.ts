import { CFGs, graph } from "./util.ts";

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

/* Main function */
const main = (cfgs: Record<string, graph>, args: string[]) => {
  return cfgs;
};

if (import.meta.main) {
  const datastring = await readStdin();
  const cfgs = await CFGs(datastring);
  const result = main(cfgs, Deno.args);
  console.log(result);
}

export default main;
