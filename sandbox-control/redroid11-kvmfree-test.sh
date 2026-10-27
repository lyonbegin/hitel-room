#!/usr/bin/env bash
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive
echo RAILWAY_REDDROID_PROBE_STARTED
uname -a
echo BINDER_HOST_FILESYSTEMS
grep -i binder /proc/filesystems || true
echo KERNEL_MODULE_BINDER
lsmod | grep -i binder || true
command -v modprobe >/dev/null || (sudo apt-get update -qq && sudo apt-get install -y -qq kmod >/dev/null)
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder" >/tmp/binder-modprobe.out 2>&1 || true
echo BINDER_DEVICE_CHECK
ls -la /dev/*binder* 2>&1 || true
if ! ls /dev/binder >/dev/null 2>&1; then
  sudo mkdir -p /dev/binderfs
  sudo mount -t binder binder /dev/binderfs >/tmp/binder-mount.log 2>&1 || true
  ls -al /dev/binderfs || true
  if test -e /dev/binderfs/binder-control; then
    echo BINDERFS_AVAILABLE
  else
    echo REDROID_KERNEL_MISSING_BINDER_DRIVER
    cat /tmp/binder-modprobe.out /tmp/binder-mount.log 2>/dev/null || true
    exit 34
  fi
fi
if ! command -v docker >/dev/null 2>&1; then
  echo INSTALL_DOCKER
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker.io >/tmp/hitel-docker-install.log 2>&1
fi
echo DOCKER_VERSION
sudo docker version || true
if ! sudo docker info >/dev/null 2>&1; then
  echo START_DOCKER_DAEMON
  sudo dockerd >/tmp/hitel-dockerd.log 2>&1 &
  for n in $(seq 1 45);do sudo docker info >/dev/null 2>&1 && break || sleep 1;done
fi
sudo docker info >/dev/null 2>&1 || { echo DOCKER_DAEMON_UNAVAILABLE; exit 40; }
echo REDROID_DOCKER_STARTING
sudo docker run --detach --rm --privileged --name hitel-redroid11 \
  --pull always -p 127.0.0.1:5555:5555 \
  redroid/redroid:11.0.0-latest \
  androidboot.redroid_gpu_mode=guest \
  androidboot.use_memfd=1
sudo apt-get install -y -qq adb >/tmp/hitel-adb-install.log 2>&1
adb connect 127.0.0.1:5555 || true
echo REDROID_ANDROID11_BOOTING
for n in $(seq 1 180);do
  if ! sudo docker ps --format '{{.Names}}' | grep -qx hitel-redroid11; then
    echo REDROID_PROCESS_EXITED
    sudo docker logs hitel-redroid11 2>&1 | tail -n 70 || true
    exit 42
  fi
  version=$(adb -s 127.0.0.1:5555 shell getprop ro.build.version.release 2>/dev/null | tr -d '\r' || true)
  complete=$(adb -s 127.0.0.1:5555 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
  if [[ "$version" == 11 && "$complete" == 1 ]];then
    echo REDROID_ANDROID11_REAL_BOOT_SUCCESS
    adb -s 127.0.0.1:5555 shell getprop ro.product.model
    exit 0
  fi
  [[ $((n%30)) == 0 ]] && echo "REDROID_ANDROID11_BOOT_PENDING_$n" || true
  sleep 1
done
sudo docker logs hitel-redroid11 2>&1 | tail -n 70 || true
echo REDROID_ANDROID11_BOOT_TIMED_OUT
exit 43
