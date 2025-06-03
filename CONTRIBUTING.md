## Build from source
>[!NOTE]
> Building from source is only required if you'd like to contribute. The recommended way to use Sourcebot is to use the [pre-built docker image](https://github.com/sourcebot-dev/sourcebot/pkgs/container/sourcebot).

1. Install <a href="https://go.dev/doc/install"><img src="https://go.dev/favicon.ico" width="16" height="16"> go</a>, and <a href="https://nodejs.org/"><img src="https://nodejs.org/favicon.ico" width="16" height="16"> NodeJS</a>. Note that a NodeJS version of at least `21.1.0` is required.

2. Install [ctags](https://github.com/universal-ctags/ctags) (required by zoekt)
    ```sh
    // macOS:
    brew install universal-ctags

    // Linux:
    snap install universal-ctags
    ```

3. Install <a href="https://docs.docker.com/get-started/get-docker/"><img src="https://www.docker.com/favicon.ico" width="16" height="16"> docker</a> and start the development Docker containers for PostgreSQL and Redis.

    ```sh
    docker compose -f docker-compose-dev.yml up -d
    ```

4. Clone the repository with submodules:
    ```sh
    git clone --recurse-submodules https://github.com/sourcebot-dev/sourcebot.git
    ```

5. Run `make` to build zoekt and install dependencies:
    ```sh
    cd sourcebot
    make
    ```

    The zoekt binaries and web dependencies are placed into `bin` and `node_modules` respectively.

6. Create a copy of `.env.development` and name it `.env.development.local`. Update the required environment variables.

7. If you're using a declerative configuration file (the default behavior if you didn't enable auth), create a configuration file and update the `CONFIG_PATH` environment variable in your `.env.development.local` file.

8. Start Sourcebot with the command:
    ```sh
    yarn dev
    ```

    A `.sourcebot` directory will be created and zoekt will begin to index the repositories found in the `config.json` file.

9. Start searching at `http://localhost:3000`.
