<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
  <img src=".github/images/logo_light.png">
</picture>


## About
todo

## Getting Started

1. Clone the repo
```sh
   git clone https://github.com/TaqlaAI/sourcebot.git
```

2. 

Run the image from github
```sh
    docker run -d -p 3000:3000 --name sourcebot -v $(pwd):/data ghcr.io/taqlaai/sourcebot:main
```