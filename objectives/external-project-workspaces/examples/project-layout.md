# Project Layout Example

Target external workspace shape:

```txt
codecaine-site/
├── ProjectSettings/
│   ├── project.json
│   └── registries/
│       ├── assets.json
│       └── modules.json
├── Assets/
│   ├── Scenes/
│   │   ├── title/scene.json
│   │   └── menu/scene.json
│   ├── Media/
│   │   ├── audio/
│   │   ├── image/
│   │   ├── video/
│   │   └── glyph/
│   ├── Modules/
│   │   ├── components/
│   │   └── effects/
│   └── Fonts/
├── Library/
└── Builds/
```

`Library/` and `Builds/` should usually be gitignored by the project repo.
The exported static bundle can keep the current web shape:

```txt
codecaine.zip
├── project.json
├── scenes/
├── assets/
├── modules/
├── fonts/
├── renderer/
├── boot.js
├── Makefile
└── server.mjs
```
