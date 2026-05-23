PORT ?= 4173
HOST ?= 127.0.0.1

.PHONY: help run

help:
	@printf '%s\n' 'Exported MELEE scene build'
	@printf '%s\n' ''
	@printf '%s\n' '  make run              Serve this export locally'
	@printf '%s\n' '  make run PORT=5000    Serve on another port'
	@printf '%s\n' '  make run HOST=0.0.0.0 Serve on all network interfaces'
	@printf '%s\n' ''
	@printf '%s\n' 'Open http://$(HOST):$(PORT)/ after the server starts.'

run:
	@node server.mjs --host $(HOST) --port $(PORT)
