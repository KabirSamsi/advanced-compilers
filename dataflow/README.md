## Run

We use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/)!

Since we need to evaluate our dataflow analysis, we use turnt.

```shell
 turnt df/*.bril
```

To run an individual bril program, specify the desired analysis:
```shell
deno --allow-run main.ts < df/cond.bril live
```

We support:
- Live Variable Analysis (`live`)
- Reaching Definitions Analysis (`reaching`)
- Constant Propagation (numbers/booleans) Analysis (`cprop`)

## Links

Writeup: 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/4//#tasks
