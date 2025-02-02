files=(combo diamond double double-pass reassign reassign-dkp simple skipped) 
for n in ${files[@]}; 
do
    echo "FILE:" $n".bril"
    printf "\nInitial Implementation\n"
    cat test/$n.bril
    printf "\nFinal Implementation\n"
    bril2json < test/$n.bril > test/$n.json && node dce.js test/$n.json | bril2txt
    printf "\n"
done