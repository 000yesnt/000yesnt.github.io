+++
title = 'Building and deploying Frigate for old CPUs'
date = 2025-04-26T04:03:53-03:00
draft = false
+++

If you try to run the official [Frigate](https://frigate.video/) docker image on a CPU that doesn't support AVX instructions, it will crash. For users that want to run Frigate on such hardware anyway, a [community-maintained custom version](https://github.com/blakeblackshear/frigate-hass-addons/tree/main/frigate_oldcpu) exists. However, as far as I'm aware, no prebuilt image exists (other than mine, see Building section)

This is a guide that covers how to build and deploy such version, as well as bugs that I found while testing and my solution for them.

# Building

**FYI:** I push prebuilt images to [Docker Hub](https://hub.docker.com/r/000yesnt/frigate-oldcpu) to save people's time. Versions 0.15.1 and newer should come with attestations enabled. I recommend you use them unless your hardware is somehow incompatible.

```shell
# Make a new folder to put the Dockerfile into
mkdir frigate-oldcpu-build
cd frigate-oldcpu-build
wget https://raw.githubusercontent.com/blakeblackshear/frigate-hass-addons/refs/heads/main/frigate_oldcpu/Dockerfile
# If you want your image to work on AVX-less CPUs, you must build it on an AVX-less system too
# WARNING: Building will take a really long time! If running in a SSH session, use screen or tmux!
docker buildx build -t frigate-oldcpu:0.15.1 -t frigate-oldcpu .
```

# Deploying: Docker Compose

Deploy it in the same way as you would a normal Frigate container - just switch the image tag to the one you just built.

If you're using my prebuilt image, use `000yesnt/frigate-oldcpu`

## Object Detection

CPUs this old are unlikely to handle object detection for more than one or two cameras. I strongly recommend getting a Coral or [offloading the processing to a more powerful computer in LAN.](https://docs.frigate.video/configuration/object_detectors#deepstack--codeprojectai-server-detector)

# Deploying: Docker Swarm

There's a weird and rare bug on all frigate-oldcpu images. Sometimes, the container will freeze and its RAM usage will explode, slowing down the server until the OOM killer does something.

I chose to mitigate this bug by deploying the container in a single-node swarm. Unlike a normal deployment, when a container in a swarm is unhealthy, Docker will automatically recreate it. Also, memory limits only seem to work in Swarm mode. In normal Compose mode, they're completely ignored.

You will need to make a few modifications to your Docker Compose file:

```yaml
services:
  frigate:
    container_name: frigate
    image: 000yesnt/frigate-oldcpu:latest
    #restart: always
    #shm_size: "96mb"
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /path/to/your/config:/config
      - /path/to/your/storage:/media/frigate
      - type: tmpfs # shm_size isn't compatible with Swarm configs
        target: /dev/shm
        tmpfs:
          size: 256000000 #256m
    ports:
      - "5000:5000"
      - "8554:8554" # RTSP feeds
      - "8555:8555/tcp" # WebRTC over tcp
      - "8555:8555/udp" # WebRTC over udp
      - "1883:1883" # MQTT Broker
    deploy:
      mode: global
      placement:
        constraints:
          - node.role == manager # Makes sure only the master node has Frigate up
      resources:
        limits:
          memory: "1G" # Limits Frigate's RAM usage to prevent the aforementioned bug
```
