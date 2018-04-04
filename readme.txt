docker run --env COTURN_PORT_3478_TCP_ADDR=54.169.103.77  --env COTURN_PORT_3478_TCP_PORT=443 --name kms9999 -p 9999:9999 -d kurento/kurento-media-server:6.1.0 




sudo docker run -d --name kurento1 -p 8888:8888 fiware/stream-oriented-kurento

curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: 127.0.0.1:9999" -H "Origin: 127.0.0.1" http://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:9999/kurento
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: 127.0.0.1:8888" -H "Origin: 127.0.0.1" http://127.0.0.1:8888/kurento

sudo docker exec -it kms1 /bin/bash

docker ps
docker ps -a
docker rm $(docker ps -qa --no-trunc --filter "status=exited")

turnURL=turn:turn@54.169.103.77:443

running ubuntu in docker
=========================
docker run -it ubuntu
apt-get update && apt-get install -y ubuntu-server

remove all images
==================
docker rmi $(docker images -a -q)




------------------------------------  UPDATE --------------------------------------------
Successfully installed 5 kurento media servers in 1 core 1gb ram free tire machine 

Basic docker command
======================
1. list all containers -  docker ps -a
2. remove all exited containers - docker rm $(docker ps -qa --no-trunc --filter "status=exited")
3. remove a container - docker rm containername
4. remove all images - docker rmi $(docker images -a -q)
5. for enter docker shell - sudo docker exec -it kms1 /bin/bash
dockerfile path : /home/centos/kurento-docker/docker

Command for build image
===========
docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 fiware/stream-oriented-kurento

Command for run image
=========
first server : docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 -d --name kms8888 -p 8888:8888 fiware/stream-oriented-kurento
second server : docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 -d --name kms9999 -p 9999:8888 fiware/stream-oriented-kurento
third server : docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 -d --name kms7777 -p 7777:8888 fiware/stream-oriented-kurento
fourth server : docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 -d --name kms6666 -p 6666:8888 fiware/stream-oriented-kurento
third server : docker run --env KMS_TURN_URL=turn:turn@54.169.103.77:443 -d --name kms5555 -p 5555:8888 fiware/stream-oriented-kurento

URLs of kurento media servers 
server1 : ws://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:8888/kurento
server2 : ws://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:9999/kurento
server1 : ws://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:7777/kurento
server1 : ws://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:6666/kurento
server1 : ws://ec2-54-153-117-95.us-west-1.compute.amazonaws.com:5555/kurento

--------------------------------- UPDATE END -----------------------------------------