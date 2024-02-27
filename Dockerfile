# base
from node:10.24.1
run npm install -g gulp@3.9.1

user root
run mkdir -p /work/app
workdir /work/app
copy . /work/app/
run npm install
run npm rebuild node-sass
run npm install -g serve@13.0.4
run gulp
workdir ./build

# expose
EXPOSE 3000

# cmd
ENTRYPOINT ["serve"]