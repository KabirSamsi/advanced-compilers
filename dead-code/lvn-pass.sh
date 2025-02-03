printf "\nInitial Implementation\n"
cat lvn-test/$1.bril
printf "\nFinal Implementation\n"
bril2json < lvn-test/$1.bril > lvn-test/$1.json && node dce.js lvn-test/$1.json | bril2txt
printf "\n"