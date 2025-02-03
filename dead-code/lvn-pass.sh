printf "\nInitial Implementation\n"
cat lvn-test/$1.bril
printf "\nFinal Implementation\n"
bril2json < lvn-test/$1.bril | node dce.js | bril2txt
printf "\n"