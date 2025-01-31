# Bril Variable Analysis Tool
### Developed by Kabir Samsi (kas499) for CS6120 (Advanced Compilers)

An analysis tool for Bril programs – performs various analyses on usages of variables. This includes:
- Counting instances of types being used
- Counting instances of variables being referenced 
- Monitoring which variables reference others
- Searching for unused variables to assist in dead-code elimination

Usage
- Convert a Bril program to JSON
- Run the script with the corresponding JSON file passed in as the sole command-line argument.