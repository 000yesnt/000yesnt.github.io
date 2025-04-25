+++
title = 'Tips for extremely low-end homeservers'
date = 2025-04-24T18:12:04-03:00
draft = false
+++

By low end, I mean *ancient* hardware. For example, my "NAS" with an Intel Pentium E5400.

This post is more of a list of resources for squeezing a little bit extra power out of obsolete hardware, though some of these tips will work for modern constrained devices like Raspberry Pis. I might update this as I find more useful tips.

# ZRAM as Swap
You can trade some CPU power for additional "RAM" with ZRAM. Depending on the kind of services you'll be hosting, this may be a viable option to squeeze more services into the same hardware.
- [ZRAM on the Arch Linux wiki](https://wiki.archlinux.org/title/Zram). I recommend at least checking out the section on [optimizing swap on ZRAM](https://wiki.archlinux.org/title/Zram#Optimizing_swap_on_zram) even if you're not using an Arch distro.
- [Setting up ZRAM on Debian-based distros](https://wiki.debian.org/ZRam)

While it might be tempting to make a huge ZRAM partition, doing that might *degrade* system stability, rather than improve it. Keeping too much data in ZRAM will cause additional latency and excessive CPU usage.

In my setup, I use ZRAM and SSD swaps, both with the same size (2GB). I found that it's a good balance between compressed memory and CPU usage. YMMV.

# Small stuff
- Use the latest kernel version available on your distro's repositories. 
- Use Wireguard (or Tailscale) as your VPN. They're crazy fast. I haven't seen anyone with a homelab use anything other than those two in a long time, but I thought I'd mention it anyway.
- If you can avoid using Nextcloud, do so. If you *really* like [a specific feature](https://web.archive.org/web/20250414202236/https://wiki.futo.org/index.php/Introduction_to_a_Self_Managed_Life:_a_13_hour_%26_28_minute_presentation_by_FUTO_software#Nextcloud_Notes_to_replace_Google_Keep), go ahead, but I wouldn't use it for anything more.

# Microoptimizations
This section is for stuff that either didn't work or had minimal impact on performance/throughput.

## Forcing NGINX to use ChaCha20
It's theoretically faster than AES on devices without AES-NI. I've only tested this on the latest Debian Testing NGINX version at the time of writing (1.26.3).
```
# Microoptimization: force ChaCha20 whenever possible, since I don't have AES-NI
ssl_ciphers "ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
ssl_conf_command Options PrioritizeChaCha;
ssl_conf_command Ciphersuites TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384;
ssl_prefer_server_ciphers on;
```
It kinda sorta worked, but the bandwidth improvement was so small it's not worth it.
