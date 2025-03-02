import { assertExists } from "@std/assert";
import { CFGs } from "./util.ts";
import main from "./main.ts";

for await (const entry of Deno.readDir("test")) {
  if (entry.isFile) {
    Deno.test(`Testing file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const cfgs = await CFGs(fileContent);
      const result = main(cfgs, []);
      console.log(cfgs);
      assertExists(cfgs);
    });
  }
}
