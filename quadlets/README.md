This directory contains the files needed to deploy Sourcebot via Podman Quadlets.  This is an alternative to Docker Compose that has a number of notable differences:

- Containers are managed as systemd services, including logging as such.
- Online Auto-Update of container images with automatic rollback on update failure. NOTE: The schedule for auto-updating is disabled by default. For instructions on running it manually or enabling the schedule, see the [Podman AutoUpdate](#podman-autoupdate) section.
- Supports injecting podman secrets as environmental values (not just as files like docker does). This is very useful for keeping things like SOURCEBOT_AUTH_SECRET, SOURCEBOT_ENCRYPTION_KEY, DATABASE_URL, and various other sensitive environmental variables secret.
- Supports podman pods (podman 5+ only), which make it easy to isolate inter-container networking.

This particular deployment assumes you are running podman 5+ as it uses Quadlets to define a Pod.

# Usage
1. Copy the contents of this directory to a [valid quadlet directory](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html#synopsis) on the destination machine. At the time of this writing that can be:

> Podman rootful unit search path
>
> Quadlet files for the root user can be placed in the following directories ordered in precedence. Meaning duplicate named quadlets found under /run take precedence over ones in /etc, as well as those in /usr:
>
> Temporary quadlets, usually used for testing:
>
>     /run/containers/systemd/
>
> System administrator’s defined quadlets:
>
>     /etc/containers/systemd/
>
> Distribution defined quadlets:
>
>     /usr/share/containers/systemd/
>
> Podman rootless unit search path
>
> Quadlet files for non-root users can be placed in the following directories:
>
>     $XDG_RUNTIME_DIR/containers/systemd/
>
>     $XDG_CONFIG_HOME/containers/systemd/ or ~/.config/containers/systemd/
>
>     /etc/containers/systemd/users/$(UID)
>
>     /etc/containers/systemd/users/
>
> Using symbolic links
>
> Quadlet supports using symbolic links for the base of the search paths and inside them.
>
> *Source: https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html#synopsis*

Note that as systemd services can specify the user they run as, rootful quadlets do not necessarily run as the root user. This is demonstrated in [sourcebot.container](sourcebot.container), where user `sourcebot` is specified.

2. If you are *not* using Enterprise Edition, edit the [sourcebot.container](sourcebot.container) file and remove the `Secret=SOURCEBOT_EE_LICENSE_KEY,type=env` line.

3. Create podman secrets for sensitive settings.  As an example, see [setup-quadlets.sh](setup-quadlets.sh), which generates basic required secrets.  You'll need to add others like API Keys yourself.

> [!important]
> `podman secret create` does not trim newlines from input. If you do not account for this then secrets can 'mysteriously' not work.
>
> Workarounds:
> 1. Use `printf` instead of `echo` to pipe values to `podman secret create` without appending a newline character.
> 2. Pipe values to `tr -d '\n'` prior to piping to `podman secret create` to remove newline characters.

4. Optionally delete the `secrets` subdirectory.  This is more secure, but will prevent rerunning the `setup-quadlets.sh` script with `GENERATE_NEW_SECRETS` set to 'N'. That is used to drop and recreate the secrets without changing them.  Useful if you suspect you've succumbed to the important issue noted above.

5. Once everything is in place, you can start the pod via:
```bash
systemctl daemon-reload
systemctl start sourcebot-pod
```
This will start all services in the pod.

## Podman AutoUpdate
Podman includes auto-update functionality that will pull the latest version of a container, try to get it running, and revert if it fails.  The included quadlets are configured to take advantage of this process if desired.

You can run auto-update manually via `podman auto-update`.  This runs auto-update once but does not enable automatic runs.

To run auto-update on a scheduled basis, enable the systemd timer via `systemctl enable podman-auto-update`. By default, the timer is set to trigger at midnight.
