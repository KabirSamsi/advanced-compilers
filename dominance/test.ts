import { assertExists } from "@std/assert";
import main from "./main.ts";

for await (const entry of Deno.readDir("test")) {
  if (entry.isFile) {
    Deno.test(`Testing file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const result = await main(fileContent,[]);
      console.log(result);
      assertExists(result);
    });
  }
}
