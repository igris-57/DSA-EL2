#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

/**
 * Fenwick Tree (Binary Indexed Tree) Implementation in C
 *
 * Supports:
 * - Point updates: O(log n)
 * - Range sum queries: O(log n)
 * - Prefix sum queries: O(log n)
 */

typedef struct
{
    int *tree; // tree → integer array that stores partial sums
    int size; // size → number of elements the tree supports
} FenwickTree;

/**
 *
 * The array uses 1-based indexing
 * Index 0 is intentionally unused


 * Computes the Least Significant SET Bit (LSSB)
 * LSB is the rightmost set bit in binary representation

 * Example:
 *   12 in binary: 1100, LSB = 4 (0100)
 *   7 in binary: 111, LSB = 1 (001)
 *
 * The Fenwick Tree uses the LSB to:
      Jump to the next responsible node during updates
      Jump to the previous contributing node during queries
 *
 *
 */
int lsb(int x)
{
    return x & (-x);
}



/**
 * Creates a new Fenwick Tree of specified size
 * Returns pointer to FenwickTree or NULL on failure
 */
FenwickTree *createFenwickTree(int size)
{
    if (size <= 0)
    {
        printf("Error: Size must be positive\n");    // Check if size is valid
        return NULL;
    }

    FenwickTree *ft = (FenwickTree *)malloc(sizeof(FenwickTree));
    if (ft == NULL)
    {
        printf("Error: Memory allocation failed\n");
        return NULL;
    }

    ft->size = size;
    ft->tree = (int *)calloc(size + 1, sizeof(int));      // Because index 0 is unused; valid indices are 1 to size

    if (ft->tree == NULL)
    {
        printf("Error: Memory allocation failed\n");
        free(ft);
        return NULL;
    }

    return ft;
}

/**
 * Frees memory allocated for Fenwick Tree  &&  Prevents memory leaks.
 */
void destroyFenwickTree(FenwickTree *ft)
{
    if (ft != NULL)
    {
        free(ft->tree);
        free(ft);
    }
}

/**
 * Updates the value at given index by adding delta
 *
 * @param ft - Pointer to FenwickTree
 * @param index - 1-based index (1 to size)
 * @param delta - Value to add
 *
 * Example: update(ft, 5, 10) adds 10 to index 5
 */

void update(FenwickTree *ft, int index, int delta)
{
    if (ft == NULL)
    {
        printf("Error: FenwickTree is NULL\n");
        return;
    }

    if (index < 1 || index > ft->size)
    {
        printf("Error: Index %d out of bounds [1, %d]\n", index, ft->size);
        return;
    }

    // Propagate update upward through parent nodes
    while (index <= ft->size)
    {
        ft->tree[index] += delta;
        index += lsb(index); // Move to next parent
    }
}

/**
 * Computes prefix sum from index 1 to given index
 * Returns sum of elements from 1 to index
 *
 * @param ft - Pointer to FenwickTree
 * @param index - 1-based index (1 to size)
 * @return Sum from index 1 to index
 *
 * Example: prefixSum(ft, 7) returns sum of indices 1 to 7
 */
int prefixSum(FenwickTree *ft, int index)
{
    if (ft == NULL)
    {
        printf("Error: FenwickTree is NULL\n");
        return 0;
    }

    if (index < 1 || index > ft->size)
    {
        printf("Error: Index %d out of bounds [1, %d]\n", index, ft->size);
        return 0;
    }

    int sum = 0;

    // Traverse downward by subtracting LSB
    while (index > 0)
    {
        sum += ft->tree[index];
        index -= lsb(index); // Move to next contributing node
    }

    return sum;
}

/**
 * Computes sum of elements in range [left, right]
 *
 * @param ft - Pointer to FenwickTree
 * @param left - Left bound (1-based, inclusive)
 * @param right - Right bound (1-based, inclusive)
 * @return Sum of elements from left to right
 *
 * Example: rangeSum(ft, 3, 7) returns sum of indices 3, 4, 5, 6, 7
 */
int rangeSum(FenwickTree *ft, int left, int right)
{
    if (ft == NULL)
    {
        printf("Error: FenwickTree is NULL\n");
        return 0;
    }

    if (left < 1 || right > ft->size || left > right)
    {
        printf("Error: Invalid range [%d, %d]\n", left, right);
        return 0;
    }

    // rangeSum(left, right) = prefixSum(right) - prefixSum(left-1)

    /*
    Prefix sums already contain cumulative data.
    Subtracting removes unwanted elements.
    */

    if (left == 1)
    {
        return prefixSum(ft, right);
    }
    else
    {
        return prefixSum(ft, right) - prefixSum(ft, left - 1);
    }
}

/**
 * Builds Fenwick Tree from an array in O(n) time
 *
 * @param ft - Pointer to FenwickTree
 * @param arr - Input array (0-indexed)
 * @param size - Size of array
 *
 *
 * Builds the Fenwick Tree directly from an array faster than repeated updates.
 *
 */
void buildTree(FenwickTree *ft, int arr[], int size)
{
    if (ft == NULL)
    {
        printf("Error: FenwickTree is NULL\n");
        return;
    }

    if (size != ft->size)
    {
        printf("Error: Array size %d doesn't match tree size %d\n",
               size, ft->size);
        return;
    }

    // Reset tree to zeros
    for (int i = 0; i <= ft->size; i++)
    {
        ft->tree[i] = 0;
    }

    // Build tree efficiently in O(n)
    for (int i = 0; i < size; i++)
    {
        update(ft, i + 1, arr[i]);
    }
}

/**
 * Gets value at specific index
 * Note: Computes as difference of prefix sums
 */
int getValue(FenwickTree *ft, int index)
{
    if (index == 1)
    {
        return prefixSum(ft, 1);
    }
    else
    {
        return prefixSum(ft, index) - prefixSum(ft, index - 1);
    }
}

/**
 * Prints the tree (for debugging)
 *
 * Useful for understanding how data is stored internally.
 * 
 */
void printTree(FenwickTree *ft)
{
    if (ft == NULL)
    {
        printf("Tree is NULL\n");
        return;
    }

    printf("Fenwick Tree (size=%d):\n", ft->size);
    printf("Index:  ");
    for (int i = 1; i <= ft->size; i++)
    {
        printf("%4d ", i);
    }
    printf("\nTree:   ");
    for (int i = 1; i <= ft->size; i++)
    {
        printf("%4d ", ft->tree[i]);
    }
    printf("\n");
}

/**
 * Demonstration program
 */
int main()
{
    printf("=== Fenwick Tree Demo ===\n\n");

    // Create tree of size 10
    FenwickTree *ft = createFenwickTree(10);
    if (ft == NULL)
    {
        return 1;
    }

    // Example 1: Point updates
    printf("1. Point Updates:\n");
    update(ft, 1, 5); // Add 5 to index 1
    update(ft, 3, 3); // Add 3 to index 3
    update(ft, 5, 7); // Add 7 to index 5
    update(ft, 7, 2); // Add 2 to index 7

    printf("   Updated indices: 1(+5), 3(+3), 5(+7), 7(+2)\n");
    printTree(ft);
    printf("\n");

    // Example 2: Prefix sum queries
    printf("2. Prefix Sum Queries:\n");
    printf("   prefixSum(1) = %d (should be 5)\n", prefixSum(ft, 1));
    printf("   prefixSum(3) = %d (should be 8)\n", prefixSum(ft, 3));
    printf("   prefixSum(5) = %d (should be 15)\n", prefixSum(ft, 5));
    printf("   prefixSum(7) = %d (should be 17)\n", prefixSum(ft, 7));
    printf("\n");

    // Example 3: Range sum queries
    printf("3. Range Sum Queries:\n");
    printf("   rangeSum(1, 3) = %d (should be 8)\n", rangeSum(ft, 1, 3));
    printf("   rangeSum(3, 5) = %d (should be 10)\n", rangeSum(ft, 3, 5));
    printf("   rangeSum(1, 7) = %d (should be 17)\n", rangeSum(ft, 1, 7));
    printf("   rangeSum(5, 7) = %d (should be 9)\n", rangeSum(ft, 5, 7));
    printf("\n");

    // Example 4: Build from array
    printf("4. Build from Array:\n");
    int arr[] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
    buildTree(ft, arr, 10);
    printf("   Built from array: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\n");
    printTree(ft);
    printf("\n");

    printf("5. Queries on Built Tree:\n");
    printf("   prefixSum(5) = %d (sum of 1+2+3+4+5 = 15)\n", prefixSum(ft, 5));
    printf("   rangeSum(3, 7) = %d (sum of 3+4+5+6+7 = 25)\n",
           rangeSum(ft, 3, 7));
    printf("   rangeSum(1, 10) = %d (sum of 1 to 10 = 55)\n",
           rangeSum(ft, 1, 10));
    printf("\n");

    // Example 6: Log Event Simulation
    printf("6. Log Event Simulation:\n");
    FenwickTree *events = createFenwickTree(168); // 7 days * 24 hours

    // Simulate some events at different hours
    update(events, 10, 5);  // 5 events at hour 10
    update(events, 15, 8);  // 8 events at hour 15
    update(events, 20, 3);  // 3 events at hour 20
    update(events, 50, 12); // 12 events at hour 50

    printf("   Events logged at hours: 10(5), 15(8), 20(3), 50(12)\n");
    printf("   Total events in hours 1-24: %d\n", rangeSum(events, 1, 24));
    printf("   Total events in hours 10-20: %d\n", rangeSum(events, 10, 20));
    printf("   Total events in hours 40-60: %d\n", rangeSum(events, 40, 60));
    printf("\n");

    // Cleanup
    destroyFenwickTree(ft);
    destroyFenwickTree(events);

    printf("=== Demo Complete ===\n");
    return 0;
}