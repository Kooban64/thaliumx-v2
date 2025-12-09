{
  "targets": [
    {
      "target_name": "liquibook",
      "sources": [
        "src/addon.cc",
        "src/order_book_wrapper.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./liquibook-src/src/book",
        "./liquibook-src/src"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "LIQUIBOOK_IGNORES_DEPRECATED_CALLS"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.7"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    }
  ]
}