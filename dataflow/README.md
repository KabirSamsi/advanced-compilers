## Run

We use Deno. You can install it [here](https://docs.deno.com/runtime/getting_started/installation/)!

Since we need to evaluate our dataflow analysis, we use turnt.

```shell
 turnt df/*.bril
```

To run an individual bril program either use 
```shell
 bril2json < df/cfg.bril | deno main.ts
```
or we can run it through bril2json for you
```shell
deno --allow-run main.ts < df/cfg.bril
```

## Links

Writeup: 

Tasks: https://www.cs.cornell.edu/courses/cs6120/2025sp/lesson/4//#tasks
