# Pi SDK Runtime Evidence

SDK package:

```text
@mariozechner/pi-coding-agent@0.73.1
```

Compatibility checks:

```text
npm view @mariozechner/pi-coding-agent@0.73.1 engines
=> { "node": ">=20.6.0" }

npm view @earendil-works/pi-coding-agent@0.75.5 engines
=> { "node": ">=22.19.0" }
```

Electron runtime import:

```text
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "import('@mariozechner/pi-coding-agent')..."
=> Node 20.16.0, createAgentSession function, SessionManager function
```

Packaged `app.asar` import:

```text
ELECTRON_RUN_AS_NODE=1 Main Menu.app/Contents/MacOS/Main Menu -e "import(file:///.../app.asar/node_modules/@mariozechner/pi-coding-agent/dist/index.js)..."
=> createAgentSession function, SessionManager function
```

Prompt execution was not exercised in validation to avoid consuming credentials,
tokens, or applying unreviewed file edits. The app wiring reaches the SDK-owned
session path on first send.
