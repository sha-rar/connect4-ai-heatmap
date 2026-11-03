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

# Shared fixture loader for tests and benchmarks.
add_library(connect4_support STATIC
  support/json.cpp
  support/fixtures.cpp
)
target_include_directories(connect4_support PUBLIC support)
target_link_libraries(connect4_support PUBLIC connect4_engine)
target_compile_definitions(connect4_support PRIVATE
  CONNECT4_FIXTURE_DIR="${CMAKE_CURRENT_SOURCE_DIR}/../tests/fixtures"
)

option(CONNECT4_BUILD_TESTS "Build the engine tests" ON)
if(CONNECT4_BUILD_TESTS)
  enable_testing()
  add_executable(connect4_tests
    tests/harness.cpp
    tests/test_position.cpp
    tests/test_evaluate.cpp
    tests/test_search.cpp
  )
  target_link_libraries(connect4_tests PRIVATE connect4_engine connect4_support)
  add_test(NAME connect4_tests COMMAND connect4_tests)
endif()
