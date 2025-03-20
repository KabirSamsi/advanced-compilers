#include <stdio.h>

int fast_exponentiation(int base, int exp) {
    int result = 1;

    while (exp > 0) {
        if (exp % 2 == 1) {
            result *= base;
        }
        base *= base;
        exp = exp / 2;
    }

    return result;
}

int main() {
    int base = 3;
    int exp = 5;
    printf("%d^%d = %d\n", base, exp, fast_exponentiation(base, exp));
    return 0;
}