printf "\nInitial Implementation\n"
cat test/$1.bril
printf "\nFinal Implementation\n"
bril2json < test/$1.bril | node dce.js | bril2txt
printf "\n"