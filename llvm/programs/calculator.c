
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
            return x/y;
            break;
        default:
            return 0;
    }
}

int main() {
    int x = 2;
    int y = 3;
    int op = 1;

    calculator(x, y, op);

    return 0;
}