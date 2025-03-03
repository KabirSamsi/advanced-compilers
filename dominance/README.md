## Run

We again use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/).

Example run for main

```shell
deno --allow-run main.ts < test/loopcond.bril dom
deno --allow-run main.ts < test/loopcond.bril tree
deno --allow-run main.ts < test/loopcond.bril front
```

## Test

### Turnt
We use turnt to verify output of each against the bril repo.

```shell
turnt test/*.bril
```

### Custom Exhaustive Tests

To run tests against everything in the test directory. You need `--allow-read` for reading the bril programs and `--allow-run` so it can run `bril2json`.

```shell
deno test --allow-read --allow-run
```

## Links

Writeup: https://github.com/sampsyo/cs6120/discussions/453#discussioncomment-12369260 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/5//#tasks
