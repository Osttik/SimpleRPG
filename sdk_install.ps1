mkdir D:\Projects\Tools
cd D:\Projects\Tools
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

.\emsdk.bat install latest
.\emsdk.bat activate latest

.\emsdk_env.ps1
emcc -v

choco install ninja