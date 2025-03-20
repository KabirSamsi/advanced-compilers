#include <stdio.h>

int factorial(int n) {
    int result = 1;

    for (int i = 2; i <= n; i++) {
        result *= i;
    }

    return result;
}

int main() {
    int num = 5;
    printf("%d! = %d\n", num, factorial(num));
    return 0;
}