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
            return x*20;
            break;
        case 3:
            return x/10;
            break;
        default:
            return 0;
    }
}

int main() {
    int x = 50;
    int y = 2;
    int op = 3;

    int result1 = calculator(x, y, op);
    printf("%i\n", result1);
    op = 2;
    int result2 = calculator(x, y, op);
    printf("%i\n", result2);
    int leftConstMult = 2*y;
    printf("%i\n", leftConstMult);

    return 0;
}