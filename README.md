<p align=center>
  <img src="https://user-images.githubusercontent.com/11330271/208825167-77d7bc78-17d0-4f33-ad35-d108b6fac730.gif" height="237px" width="344"/>
</p>
<h1 align=center>AresRPG</h1>
<p align=center>
  <img src="https://img.shields.io/badge/Made%20with-Javascript-%23f7df1e?style=for-the-badge" alt="fully in javascript"/>
  <img src="https://img.shields.io/badge/Powered%20By-Black%20Magic-blueviolet?style=for-the-badge" alt="powered by lsd"/>
  <a href="https://discord.gg/gaqrFT5">
    <img src="https://img.shields.io/discord/265104803531587584.svg?logo=discord&style=for-the-badge" alt="Chat"/>
  </a>
</p>
<h3 align=center>AresRPG is a Browser based MMORPG</h3>

### Hello World

AresRPG has been a minecraft server project for years and is now upgraded to a standalone game on top of [ThreeJS](https://threejs.org/), the project is in a very early stage and everyone is welcomed to contribute to its realization

![](https://i.imgur.com/csWCkeW.png)

- Try it out at https://play.aresrpg.world

## Contribute

You can run the client locally and communicate directly with the server by using your authentication cookie.

> Note that at the moment only users with an early access key or a Staff discord rank are able to access the websocket

- Login at https://app.aresrpg.world
- Go to your `application` tab in the devtools and find the `aresrpg_` cookie

```sh
git clone git@github.com:aresrpg/app.git
cd app
```

- Create a `.env` file

```
VITE_API="/api"
VITE_WS="ws://localhost:5174/ws"
VITE_DEV_AUTH_TOKEN="the content of the auth cookie"
```

- Run the client

```
npm install
npm start
```

Once you've made a super cool feature, you can open a pull request on this page 🥇

If it's accepted and significant enough, you'll win the contributor badge in the game !

## Protocol

To understand better how to communicate with the server, check the [protocol repo](https://github.com/aresrpg/aresrpg-protocol), it contains a D2 schema file and the proto definition
