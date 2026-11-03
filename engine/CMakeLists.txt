cmake_minimum_required(VERSION 3.20)

project(connect4_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

# Link the MinGW runtime statically so executables do not pick up a
# different libstdc++ DLL from PATH at run time.
if(MINGW)
  add_link_options(-static)
endif()

add_library(connect4_engine
  src/position.cpp
  src/evaluate.cpp
  src/search.cpp
  src/tt.cpp
)
target_include_directories(connect4_engine PUBLIC include)

if(MSVC)
  target_compile_options(connect4_engine PRIVATE /W4 /permissive-)
else()
  target_compile_options(connect4_engine PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()

# WebAssembly module for the website (configure with emcmake).
if(EMSCRIPTEN)
  add_executable(connect4_wasm wasm/bindings.cpp)
  target_link_libraries(connect4_wasm PRIVATE connect4_engine)
  set_target_properties(connect4_wasm PROPERTIES OUTPUT_NAME connect4 SUFFIX ".js")
  target_link_options(connect4_wasm PRIVATE
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sEXPORT_NAME=createConnect4Module
    -sENVIRONMENT=web,worker,node
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=33554432
    -sFILESYSTEM=0
    -sEXPORTED_FUNCTIONS=_c4_choose_move,_c4_reset,_c4_result_size,_malloc,_free
    -sEXPORTED_RUNTIME_METHODS=HEAP32
  )
  # Tests and benchmarks run natively.
  set(CONNECT4_BUILD_TESTS OFF CACHE BOOL "" FORCE)
  set(CONNECT4_BUILD_BENCH OFF CACHE BOOL "" FORCE)
endif()

# Shared fixture loader for tests and benchmarks (native only).
if(NOT EMSCRIPTEN)
  add_library(connect4_support STATIC
    support/json.cpp
    support/fixtures.cpp
  )
  target_include_directories(connect4_support PUBLIC support)
  target_link_libraries(connect4_support PUBLIC connect4_engine)
  target_compile_definitions(connect4_support PRIVATE
    CONNECT4_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/../tests/fixtures"
  )
endif()

option(CONNECT4_BUILD_TESTS "Build the engine tests" ON)
if(CONNECT4_BUILD_TESTS)
  enable_testing()
  add_executable(connect4_tests
    tests/harness.cpp
    tests/test_position.cpp
    tests/test_evaluate.cpp
    tests/test_search.cpp
    tests/test_bindings.cpp
    wasm/bindings.cpp
  )
  target_link_libraries(connect4_tests PRIVATE connect4_engine connect4_support)
  add_test(NAME connect4_tests COMMAND connect4_tests)
endif()

option(CONNECT4_BUILD_BENCH "Build the engine benchmark" ON)
if(CONNECT4_BUILD_BENCH)
  add_executable(connect4_bench bench/benchmark.cpp)
  target_link_libraries(connect4_bench PRIVATE connect4_engine connect4_support)
endif()
