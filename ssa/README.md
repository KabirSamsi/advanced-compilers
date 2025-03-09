## Run

We again use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/).

You can translate Bril programs into SSA, out of SSA, or both (roundtrip).

Use the `in` argument to only translate into SSA and preserve phi nodes.
```shell
deno --allow-run main.ts < to_phi_node/loop-branch.bril in
```

Use the `out` argument to translate an SSA bril program that uses `phi` instructions out of SSA.
```shell
deno --allow-run main.ts < to_phi_node/loop-branch.out out
```

Don't specify any parameters for roundtrip.
```shell
deno --allow-run main.ts < test/argwrite.bril
```

## Test

### Brench
We use brench to verify correctness and evaluate performance across the [bril benchmarks repository](https://github.com/sampsyo/bril/tree/main/benchmarks). We test both into SSA and out of SSA (round trip).

```shell
brench brench.toml
```

### Turnt

#### Check SSA
We use turnt to verify our roundtrip output is SSA with the `is_ssa.py` python script.

```shell
turnt roundtrip-is-ssa/*.bril
```

## Links

Writeup: 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/6//#tasks
