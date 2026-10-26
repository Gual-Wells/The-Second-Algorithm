#include "../../content/binary-search/二分查找.cpp"
#include <functional>
#include <iostream>
#include <random>
#include <stdexcept>

using namespace std;
using namespace binary_census_base;
long long digit_checks = 0, square_checks = 0;

void require(bool ok, const char* family) {
    if (!ok) throw runtime_error(family);
}

char reference_digit(ll position) {
    ll block_length = 0;
    int block = 0;
    do {
        ++block;
        block_length += to_string(block).size();
        if (position <= block_length) break;
        position -= block_length;
    } while (true);
    for (int value = 1; value <= block; ++value) {
        string word = to_string(value);
        if (position <= (ll)word.size()) return word[(size_t)position - 1];
        position -= word.size();
    }
    throw runtime_error("reference digit failed");
}

int reference_square(const vector<vector<int>>& a, int low, int high) {
    int best = 0, rows = (int)a.size(), cols = (int)a[0].size();
    for (int r = 0; r < rows; ++r) for (int c = 0; c < cols; ++c)
        for (int size = 1; r + size <= rows && c + size <= cols; ++size) {
            bool ok = true;
            for (int i = r; i < r + size; ++i) for (int j = c; j < c + size; ++j)
                if (a[i][j] < low || a[i][j] > high) ok = false;
            if (ok) best = max(best, size);
        }
    return best;
}

void check_square(const vector<vector<int>>& a, int low, int high) {
    ++square_checks;
    require(largest_square_in_range(a, low, high) == reference_square(a, low, high),
            "matrix square vs all squares/cells");
}

int main() {
    string explicit_sequence, current_block;
    for (int k = 1; k <= 350; ++k) {
        current_block += to_string(k);
        explicit_sequence += current_block;
    }
    NestedDigitSequence short_sequence(explicit_sequence.size());
    for (ll pos = 1; pos <= (ll)explicit_sequence.size(); ++pos) {
        ++digit_checks;
        require(short_sequence.at(pos) == explicit_sequence[(size_t)pos - 1],
                "nested sequence vs explicit expansion");
    }
    NestedDigitSequence full_sequence;
    vector<ll> positions{1, 3, 8, 45, 46, 54, 55, 56, 99, 100, 999, 1000,
                         2147483646LL, 2147483647LL};
    mt19937 rng(20261026);
    for (int i = 0; i < 100; ++i) positions.push_back(1 + rng() % 2147483647U);
    for (ll pos : positions) {
        ++digit_checks;
        require(full_sequence.at(pos) == reference_digit(pos),
                "nested sequence vs independent linear block/number traversal");
    }

    // Enumerate all row/column-monotone matrices up to3x3 with values0..3.
    for (int rows = 1; rows <= 3; ++rows) for (int cols = 1; cols <= 3; ++cols) {
        vector<vector<int>> a(rows, vector<int>(cols));
        function<void(int)> enumerate = [&](int p) {
            if (p == rows * cols) {
                for (int low = 0; low <= 4; ++low) for (int high = low; high <= 4; ++high)
                    check_square(a, low, high);
                return;
            }
            int r = p / cols, c = p % cols, minimum = 0;
            if (r) minimum = max(minimum, a[r-1][c]);
            if (c) minimum = max(minimum, a[r][c-1]);
            for (int value = minimum; value <= 3; ++value) {
                a[r][c] = value;
                enumerate(p + 1);
            }
        };
        enumerate(0);
    }
    vector<vector<int>> official{{13,21,25,33,34},{16,21,33,35,35},
                                 {16,33,33,45,50},{23,51,66,83,93}};
    for (auto [low, high] : vector<pair<int,int>>{{22,90},{33,35},{20,100}})
        check_square(official, low, high);
    for (int trial = 0; trial < 1000; ++trial) {
        int rows = 1 + rng() % 7, cols = 1 + rng() % 7;
        vector<vector<int>> a(rows, vector<int>(cols));
        for (int r = 0; r < rows; ++r) for (int c = 0; c < cols; ++c) {
            int previous = max(r ? a[r-1][c] : 0, c ? a[r][c-1] : 0);
            a[r][c] = previous + rng() % 4;
        }
        int low = rng() % (a.back().back() + 3), high = rng() % (a.back().back() + 3);
        if (low > high) swap(low, high);
        check_square(a, low, high);
    }
    vector<vector<int>> largest(500, vector<int>(500, 100000));
    require(largest_square_in_range(largest,100000,100000)==500,"max-size equal matrix");
    require(largest_square_in_range(largest,0,99999)==0,"max-size no match");
    cout << "digit queries: " << digit_checks << '\n'
         << "matrix queries vs exhaustive squares: " << square_checks << '\n'
         << "max-size smoke checks: 2\n"
         << "full-range precomputed groups: " << full_sequence.block_prefix.size()-1 << '\n';
}
