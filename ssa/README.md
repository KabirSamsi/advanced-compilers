## Run

We again use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/).

You can translate Bril programs into SSA, out of SSA, or both (roundtrip).

Use the `in` argument to only translate into SSA and preserve phi nodes.
```shell
bril2json < to_phi_node/loop-branch.bril | deno main.ts in | bril2txt
```

Use the `out` argument to translate an SSA bril program that uses `phi` instructions out of SSA.
```shell
bril2json < to_phi_node/loop-branch.out | deno main.ts out | bril2txt
```

Don't specify any parameters for roundtrip.
```shell
bril2json < test/argwrite.bril | deno main.ts | bril2txt
```

## Test

### Brench
We use brench to verify correctness and evaluate performance across the [bril benchmarks repository](https://github.com/sampsyo/bril/tree/main/benchmarks). We test both into SSA and out of SSA (round trip).

```shell
brench brench.toml
```

### Turnt

#### Correctness
We use `brili` to verify into SSA and out roundtrip evaluates correctly.

```shell
turnt test/*.bril -e in-run
```

```shell
turnt test/*.bril -e roundtrip-run
```

#### Check SSA

We use turnt to verify into SSA and roundtrip output is SSA with the `is_ssa.py` python script.

```shell
turnt test/*.bril -e in-valid
```

```shell
turnt test/*.bril -e roundtrip-valid
```

## Links

Writeup: https://github.com/sampsyo/cs6120/discussions/454#discussioncomment-12437998

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/6//#tasks
