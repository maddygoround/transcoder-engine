FROM jrottenberg/ffmpeg:3.3-alpine
FROM mhart/alpine-node:12

COPY --from=0 / /
VOLUME ["/root"]
# ADD setup-ffmpeg.sh /root
# RUN /root/setup-ffmpeg.sh
# Create app directory
WORKDIR /usr/src/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm install
RUN apk update && apk add bash
# If you are building your code for production
# RUN npm install --only=production
# Bundle app source
COPY . .
CMD [ "npm", "start" ]