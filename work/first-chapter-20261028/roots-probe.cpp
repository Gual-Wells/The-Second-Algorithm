#include "../../content/binary/boundary.cpp"
#include <cassert>
#include <cmath>
#include <iostream>
#include <iomanip>
int main() {
    for (long double scale : {1.0L,0.1L,0.3L,0.7L,1e-200L,1e200L,-1e-200L,-1e200L}) {
        const auto roots=binary_boundary::cubic_roots_by_critical_points(scale,-6*scale,11*scale,-6*scale);
        assert(roots.size()==3);
        for(int i=0;i<3;++i)assert(std::abs(roots[i]-(i+1))<1e-8);
    }
    const auto roots=binary_boundary::cubic_roots_by_critical_points(0.1,-0.6,1.1,-0.6);
    assert(roots.size()==3);
    for(int i=0;i<3;++i)assert(std::abs(roots[i]-(i+1))<1e-8);
    std::cout<<std::setprecision(15)<<roots[0]<<' '<<roots[1]<<' '<<roots[2]<<"; decimal and scale probes passed\n";
}
