bril2json < test/dfs.bril > test/dfs.json
tsc
node dce.js dfs
bril2txt < test/dfs.json > test/dfs.bril