cmake_minimum_required(VERSION 3.22.1)
project(hitel_expression2_core LANGUAGES C CXX)

add_library(hitel_expression2_core SHARED
    native_bridge.cpp
    ../../../../expression2-verified-core/src/expression2_verified_core.cpp
    ../../../../expression2-verified-core/src/expression2_stream_state.cpp
)
target_include_directories(hitel_expression2_core PRIVATE
    ../../../../expression2-verified-core/include
)
target_compile_features(hitel_expression2_core PRIVATE cxx_std_17)
target_compile_options(hitel_expression2_core PRIVATE -O2 -ffp-contract=off -fno-fast-math)
