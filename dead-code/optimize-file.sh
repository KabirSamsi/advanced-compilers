printf "\nInitial Implementation\n"
cat test/$1.bril
printf "\nFinal Implementation\n"
bril2json < test/$1.bril > test/$1.json && node dce.js test/$1.json | bril2txt
printf "\n"