cmake_minimum_required(VERSION 3.20)

project(connect4_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

add_library(connect4_engine
  src/position.cpp
)
target_include_directories(connect4_engine PUBLIC include)

if(MSVC)
  target_compile_options(connect4_engine PRIVATE /W4 /permissive-)
else()
  target_compile_options(connect4_engine PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()
