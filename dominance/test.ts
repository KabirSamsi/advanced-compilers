import { assertExists } from "@std/assert";
import { I } from "./main.ts";

for await (const entry of Deno.readDir("test")) {
  if (entry.isFile) {
    Deno.test(`Testing file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const result = I(fileContent);
      console.log(result);
      assertExists(result);
    });
  }
}
