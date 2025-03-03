## Run

We again use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/).

Example run for main. To preserve phi nodes (only go into SSA), include the `phi` argument.

```shell
deno --allow-run main.ts < ssa/if.bril phi
```

To go out of SSA, don't include any arguments.

```shell
deno --allow-run main.ts < ssa/if.bril
```

## Test

### Brench
We use brench to verify correctness and evaluate performance across the [bril benchmarks repository](https://github.com/sampsyo/bril/tree/main/benchmarks). We test both into SSA and out of SSA (round trip).

```shell
brench brench.toml
```

### ~~Turnt~~

We use turnt to verify our programs are SSA.

```shell
turnt ssa/*.bril
```

## Links

Writeup: 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/6//#tasks
