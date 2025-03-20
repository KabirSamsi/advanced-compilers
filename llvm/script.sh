cd build
cmake ..
make
cd ../
`brew --prefix llvm`/bin/clang -fpass-plugin=`echo build/pass/L7Pass.*` programs/calculator.c