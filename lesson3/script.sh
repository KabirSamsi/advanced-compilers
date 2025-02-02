bril2json < test/reassign.bril > test/reassign.json
tsc
node dce.js
