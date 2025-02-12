printf "\nInitial Implementation\n"
cat benchmarks/core/$1.bril
printf "\nFinal Implementation\n"
bril2json < benchmarks/core/$1.bril > benchmarks/core/$1.json 
# bril2json < benchmarks/core/$1.bril | node dce.js  > benchmarks/core/$1-updated.json 
bril2json < benchmarks/core/$1.bril | node dce.js | bril2txt
printf "\n"