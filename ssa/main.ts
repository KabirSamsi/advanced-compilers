import { readStdin } from "./util.ts";

const main = (stdin: string, preservePhiNodes: boolean) => {
  if (preservePhiNodes) {
  }
  console.log(stdin);
};

if (import.meta.main) {
  const datastring = await readStdin();
  main(datastring, Deno.args[0] === "phi");
}
