#include <stdio.h>

int calculator(int x, int y, int op) {
    switch (op) {
        case 0:
            return x + y;
            break;
        case 1:
            return x-y;
            break;
        case 2:
            return x*y;
            break;
        case 3:
            return x/0;
            break;
        default:
            return 0;
    }
}

int main() {
    int x = 50;
    int y = 2;
    int op = 3;

    int result = calculator(x, y, op);
    printf("%i\n", result);

    return 0;
}