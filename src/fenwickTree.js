/*
 * Fenwick Tree (Binary Indexed Tree) implementation for efficient range sum queries and measuring updates.
 *
 * Time Complexities:
 * - Update: O(log n)
 * - Prefix Sum: O(log n)
 * - Range Sum: O(log n)
 * - Build: O(n)
 *
 * Space Complexity: O(n)
 */
export class FenwickTree {
    /**
     * Initializes the Fenwick Tree with a specific size or from an array.
     * @param {number} size - The size of the array to manage.
     */
    constructor(size) {
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error('Size must be a positive integer.');
        }
        this.size = size;
        // 1-based indexing: array size is size + 1, index 0 is unused.
        this.tree = new Float64Array(size + 1);
    }

    /**
     * Computes the Least Significant Bit (LSB) of an integer.
     * Used for traversing the tree.
     * @param {number} x - The number to compute LSB for.
     * @returns {number} The value of the least significant bit.
     * @private
     */
    _lsb(x) {
        // Two's complement: x & (-x) returns the LSB
        return x & (-x);
    }

    /**
     * Adds a value (delta) to the element at the specified 1-based index.
     * Propagates the change to relevant nodes in the tree structure.
     * @param {number} index - The 1-based index to update.
     * @param {number} delta - The value to add.
     */
    update(index, delta) {
        if (index < 1 || index > this.size) {
            throw new Error(`Index out of bounds. Must be between 1 and ${this.size}. Received: ${index}`);
        }

        // Traverse upwards adding delta to all relevant ancestors
        // i += LSB(i) moves to the next covering range
        let i = index;
        while (i <= this.size) {
            this.tree[i] += delta;
            i += this._lsb(i);
        }
    }

    /**
     * Computes the prefix sum from index 1 up to the specified index.
     * @param {number} index - The 1-based index to sum up to.
     * @returns {number} The cumulative sum from 1 to index.
     */
    prefixSum(index) {
        if (index < 0 || index > this.size) {
            throw new Error(`Index out of bounds. Must be between 0 and ${this.size}. Received: ${index}`);
        }

        let sum = 0;
        let i = index;

        // Traverse downwards summing up partial ranges
        // i -= LSB(i) moves to the parent of the current range
        while (i > 0) {
            sum += this.tree[i];
            i -= this._lsb(i);
        }
        return sum;
    }

    /**
     * Computes the sum of values within a range [left, right].
     * @param {number} left - The 1-based start index (inclusive).
     * @param {number} right - The 1-based end index (inclusive).
     * @returns {number} The sum of the range.
     */
    rangeSum(left, right) {
        if (left < 1 || right > this.size || left > right) {
            throw new Error(`Invalid range [${left}, ${right}] for size ${this.size}.`);
        }
        return this.prefixSum(right) - this.prefixSum(left - 1);
    }

    /**
     * Constructs the Fenwick Tree from an input array in O(n) time.
     * Replaces any existing tree data.
     * @param {Array<number>} array - The input array (0-based or 1-based handling implied by internal mapping).
     * NOTE: We assume the input array is what the user conceptually wants to index 1..N.
     * If input array has length N, we map input[0] -> tree index 1, etc.
     */
    build(array) {
        if (!Array.isArray(array)) {
            throw new Error('Input must be an array.');
        }

        const n = array.length;
        if (n !== this.size) {
            // Option: Resize functionality is not explicitly requested, but for build() usually we respect the passed array or current size.
            // Let's re-initialize to match array size if different, or throw. 
            // Given "Constructor(size)", usually one fixes the size. 
            // However, to be robust, let's allow rebuilding based on array length if logical.
            // For now, let's respect the constructor size but warn or error? 
            // The prompt implies "constructs tree from array", typically this overrides/fills.
            // Let's assume the array matches the expected size or we resize.
            // Requirement says "Constructor(size) - initializes tree". "build(array) - constructs tree".
            // Let's just resize to be safe if they pass a new array.
            this.size = n;
            this.tree = new Float64Array(n + 1);
        }

        // Initialize tree with array values (assuming input is 0-indexed for convenience of the caller)
        // input[i] goes to tree[i+1]
        for (let i = 0; i < n; i++) {
            this.tree[i + 1] = array[i];
        }

        // O(n) construction:
        // Propagate current node value to its immediate parent covering range
        for (let i = 1; i <= n; i++) {
            const parent = i + this._lsb(i);
            if (parent <= n) {
                this.tree[parent] += this.tree[i];
            }
        }
    }
}

// Example Usage:
// const ft = new FenwickTree(5);
// ft.update(1, 3); // Add 3 to index 1
// ft.update(2, 5); // Add 5 to index 2
// console.log(ft.rangeSum(1, 2)); // Output: 8
//
// const ft2 = new FenwickTree(0); // Will throw
// ft2.build([1, 2, 3, 4, 5]);
// console.log(ft2.rangeSum(1, 3)); // Output: 6
