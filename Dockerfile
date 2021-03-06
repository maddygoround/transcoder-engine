# FROM jrottenberg/ffmpeg:3.3-alpine
# FROM mhart/alpine-node:12

# COPY --from=0 / /
# VOLUME ["/root"]
# # ADD setup-ffmpeg.sh /root
# # RUN /root/setup-ffmpeg.sh
# # Create app directory
# WORKDIR /usr/src/app
# # Install app dependencies
# # A wildcard is used to ensure both package.json AND package-lock.json are copied
# # where available (npm@5+)

# COPY package*.json ./

# RUN apk add --no-cache cairo cairo-dev cairomm-dev \
#     pango pango-dev pangomm pangomm-dev \
#     libjpeg-turbo-dev giflib-dev g++ make
# # RUN apk add --update --no-cache \
# #     make \
# #     build-base \
# #     g++ \
# #     jpeg-dev \
# #     cairo-dev \
# #     giflib-dev \
# #     pango-dev \
# #     libpng \
# #     libpng-dev

# # RUN apk --no-cache add ca-certificates wget  && \
# #     wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
# #     wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.29-r0/glibc-2.29-r0.apk && \
# #     apk add glibc-2.29-r0.apk

# # RUN npm_config_build_from_source=true npm i canvas --build-from-source

# RUN npm install
# # RUN npm install canvas@2.0.0-alpha.12 --build-from-source
# # RUN npm_config_build_from_source=true npm i canvas --build-from-source
# # Install tools & libs to compile everything
# RUN apk update && apk add bash && apk add --no-cache imagemagick
# # If you are building your code for production
# # RUN npm install --only=production
# # Bundle app source
# COPY . .
# CMD [ "npm", "start" ]

FROM jrottenberg/ffmpeg:4.3.1-ubuntu1804
FROM ubuntu:18.04

COPY --from=0 / /
VOLUME ["/root"]
WORKDIR /usr/src/app

# Ensures tzinfo doesn't ask for region info.
ENV DEBIAN_FRONTEND noninteractive

## INSTALL NODE VIA NVM

RUN apt-get update && apt-get install -y \
    dumb-init \
    xvfb

# Source: https://gist.github.com/remarkablemark/aacf14c29b3f01d6900d13137b21db3a
# replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# update the repository sources list
# and install dependencies
RUN apt-get update \
    && apt-get install -y curl \
    && apt-get -y autoclean

# nvm environment variables
ENV NVM_VERSION 0.37.2
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 14.4.0

# install nvm
# https://github.com/creationix/nvm#install-script
RUN mkdir -p $NVM_DIR \
    && curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v${NVM_VERSION}/install.sh | bash

# install node and npm
RUN source ${NVM_DIR}/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# add node and npm to path so the commands are available
ENV NODE_PATH ${NVM_DIR}/v${NODE_VERSION}/lib/node_modules
ENV PATH      ${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:$PATH

# confirm installation
RUN node -v
RUN npm -v

## INSTALL EDITLY

# ## Install app dependencies
COPY package*.json ./
RUN npm install

# RUN apt-get update && apt-get install -y \
#     imagemagick libmagickwand-dev --no-install-recommends \
#     && pecl install imagick \
#     && docker-php-ext-enable imagick
# Add app source

# Ensure `editly` binary available in container
RUN npm link


COPY . .
ENTRYPOINT ["/usr/bin/dumb-init", "--", "xvfb-run", "--server-args", "-screen 0 1280x1024x24 -ac"]
CMD [ "npm", "start" ]
