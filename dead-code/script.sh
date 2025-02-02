files=(combo diamond double double-pass reassign simple skipped) 
for n in ${files[@]}; 
do
    echo $n".bril"
    bril2json < test/$n.bril > test/$n.json && node dce.js test/$n.json | bril2txt
    echo
done