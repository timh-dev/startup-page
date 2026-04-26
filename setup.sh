# setup config file
echo " --- copying env file --- "
FILE=src/config/index.js
if [ -f "$FILE" ]; then
    echo "$FILE already exists."
else 
    cp src/config/index.example.js src/config/index.js
fi

# install requierments
echo " --- installing requierments --- "
pnpm install

# build package
echo " --- building site --- "
pnpm run build

# run
echo " --- running site --- "
pnpm run serve
