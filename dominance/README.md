## Run

We again use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/).

Example run for main

```shell
deno --allow-run main.ts < test/cfg.bril
```

To run tests against everything in the test file. You need `--allow-read` for reading the bril programs and `--allow-run` so it can run `bril2json`.

```shell
deno test --allow-read --allow-run
```

## Links

Writeup: 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/5//#tasks
