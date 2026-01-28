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

2. Create podman secrets for sensitive settings.  As an example, see `setup-quadlets.sh`, which generates basic required secrets.  You'll need to add others like API Keys yourself.

> [!important]
> `podman secret create` does not trim newlines from input. If you do not account for this then secrets can 'mysteriously' not work.
>
> Workarounds:
> 1. Use `printf` instead of `echo` to pipe values to `podman secret create` without appending a newline character.
> 2. Pipe values to `tr -d '\n'` prior to piping to `podman secret create` to remove newline characters.

1. Optionally delete the `secrets` subdirectory.  This is more secure, but will prevent rerunning the `setup-quadlets.sh` script with `GENERATE_NEW_SECRETS` set to 'N'. That is used to drop and recreate the secrets without changing them.
